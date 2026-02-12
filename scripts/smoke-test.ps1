param(
  [string]$ProjectPath = "C:\Users\Emmanuel\polymarket-builder-dashboard",
  [switch]$SkipServerStart
)

$ErrorActionPreference = "Stop"

function Invoke-Endpoint {
  param(
    [string]$Method,
    [string]$Url
  )

  try {
    if ($Method -eq "GET") {
      return Invoke-RestMethod -Method Get -Uri $Url
    }
    return Invoke-RestMethod -Method $Method -Uri $Url
  } catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    throw "Request failed for $Url (status: $statusCode). $_"
  }
}

function Find-ApiBaseUrl {
  param([int[]]$Ports)
  foreach ($port in $Ports) {
    $url = "http://localhost:$port/api/connection"
    try {
      $null = Invoke-RestMethod -Method Get -Uri $url
      return "http://localhost:$port"
    } catch {
      continue
    }
  }
  return $null
}

function Assert-NoSensitiveText {
  param(
    [string]$Label,
    [string]$Text
  )
  if ([string]::IsNullOrEmpty($Text)) { return }
  if ($Text -match "invalid after param") {
    throw "$Label contains invalid pagination signal: 'invalid after param'"
  }
  if ($Text -match "POLY_BUILDER_") {
    throw "$Label contains leaked builder secret key names."
  }
}

Write-Host "Project: $ProjectPath"
Set-Location $ProjectPath

if (-not (Test-Path ".\node_modules")) {
  Write-Host "node_modules missing. Running npm install..."
  npm install
}

Write-Host "Applying migrations..."
npx prisma migrate deploy

$serverProcess = $null
$logPath = Join-Path $ProjectPath "smoke-dev.log"
$baseUrl = Find-ApiBaseUrl -Ports @(3000, 3001, 3002)
if ($baseUrl) {
  Write-Host "Using existing server at $baseUrl"
}

if (-not $SkipServerStart) {
  if (-not $baseUrl) {
    Write-Host "Starting dev server in background..."
    if (Test-Path $logPath) { Remove-Item $logPath -Force }
    $serverProcess = Start-Process powershell -ArgumentList @(
      "-NoProfile",
      "-Command",
      "Set-Location '$ProjectPath'; npm run dev *>> '$logPath'"
    ) -PassThru

    Write-Host "Waiting for server..."
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 2
      $baseUrl = Find-ApiBaseUrl -Ports @(3000, 3001, 3002, 3003)
      if ($baseUrl) { break }
    }
    if (-not $baseUrl) {
      if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
      }
      throw "Dev server did not become ready on localhost:3000-3003"
    }
  }
} elseif (-not $baseUrl) {
  throw "No running server found. Start one or run without -SkipServerStart."
}

try {
  Write-Host "Using API base URL: $baseUrl"
  Write-Host "GET /api/connection"
  $connection = Invoke-Endpoint -Method "GET" -Url "$baseUrl/api/connection"
  $connectionJson = $connection | ConvertTo-Json -Depth 5
  Assert-NoSensitiveText -Label "connection response" -Text $connectionJson
  $connectionJson

  Write-Host "POST /api/sync"
  $sync = Invoke-Endpoint -Method "POST" -Url "$baseUrl/api/sync"
  $syncJson = $sync | ConvertTo-Json -Depth 5
  Assert-NoSensitiveText -Label "sync response" -Text $syncJson
  $syncJson

  Write-Host "GET /api/trades?page=1&pageSize=5"
  $trades = Invoke-Endpoint -Method "GET" -Url "$baseUrl/api/trades?page=1&pageSize=5"
  $tradesJson = $trades | ConvertTo-Json -Depth 5
  Assert-NoSensitiveText -Label "trades response" -Text $tradesJson
  $tradesJson

  Write-Host "GET /api/trades?format=csv&page=1&pageSize=50"
  $csvPath = Join-Path $ProjectPath "trades.csv"
  Invoke-WebRequest -Method Get -Uri "$baseUrl/api/trades?format=csv&page=1&pageSize=50" -OutFile $csvPath

  if (-not (Test-Path $csvPath)) {
    throw "CSV export failed: trades.csv was not created."
  }

  if ($serverProcess -and (Test-Path $logPath)) {
    $logText = Get-Content $logPath -Raw
    Assert-NoSensitiveText -Label "dev server log" -Text $logText
  }

  if (($connection.connected -ne $true) -and ($connection.error -match "401")) {
    throw "Builder connection is unauthorized (401). Check POLY_BUILDER_* env vars."
  }

  Write-Host "Smoke test passed. CSV written to $csvPath"
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Write-Host "Stopping background dev server..."
    Stop-Process -Id $serverProcess.Id -Force
  }
}
