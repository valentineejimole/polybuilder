param(
  [string]$ProjectPath = "C:\Users\Emmanuel\polymarket-builder-dashboard",
  [string]$RemoteUrl = "https://github.com/valentineejimole/polybuilder.git"
  )

  $ErrorActionPreference = "Stop"

  # Runs a git command and throws on failure.

  function Invoke-Git {
  param(
  [Parameter(Mandatory = $true)]
  [string[]]$Args
  )
  & git @Args
  if ($LASTEXITCODE -ne 0) {
  throw "git $($Args -join ' ') failed."
  }
  }

  # Ensures a line exists in .gitignore exactly once.

  function Ensure-GitIgnoreEntry {
  param(
  [Parameter(Mandatory = $true)]
  [string]$GitIgnorePath,
  [Parameter(Mandatory = $true)]
  [string]$Entry
  )

      if (-not (Test-Path $GitIgnorePath)) {
          New-Item -ItemType File -Path $GitIgnorePath -Force | Out-Null
      }

      $lines = Get-Content -Path $GitIgnorePath -ErrorAction SilentlyContinue
      if (-not $lines) { $lines = @() }

      $exists = $false
      foreach ($line in $lines) {
          if ($line.Trim() -eq $Entry.Trim()) {
              $exists = $true
              break
          }
      }

      if (-not $exists) {
          Add-Content -Path $GitIgnorePath -Value $Entry
      }

  }

  try {
  # Validate project path and switch to it.
  if (-not (Test-Path $ProjectPath)) {
  throw "Project path does not exist: $ProjectPath"
  }
  Set-Location $ProjectPath

      # Ensure git is available.
      & git --version | Out-Null
      if ($LASTEXITCODE -ne 0) {
          throw "Git is not installed or not available in PATH."
      }

      # 1) Ensure required ignore rules exist.
      $gitIgnore = Join-Path $ProjectPath ".gitignore"
      Ensure-GitIgnoreEntry -GitIgnorePath $gitIgnore -Entry ".env"
      Ensure-GitIgnoreEntry -GitIgnorePath $gitIgnore -Entry ".env.*"
      Ensure-GitIgnoreEntry -GitIgnorePath $gitIgnore -Entry "node_modules"

      # 2) Initialize repo if missing.
      if (-not (Test-Path (Join-Path $ProjectPath ".git"))) {
          Invoke-Git -Args @("init")
      }

      # 3) Set branch name to main.
      Invoke-Git -Args @("branch", "-M", "main")

      # Remove any accidentally tracked env/dependency files from index.
      & git rm --cached --ignore-unmatch .env .env.* 2>$null | Out-Null
      & git rm -r --cached --ignore-unmatch node_modules 2>$null | Out-Null

      # 4) Stage all files.
      Invoke-Git -Args @("add", "-A")

      # 5) Commit staged changes if there are any; otherwise create an empty commit only if no commits exist.
      $staged = & git diff --cached --name-only
      if ($LASTEXITCODE -ne 0) {
          throw "Unable to inspect staged changes."
      }

      if ($staged -and $staged.Count -gt 0) {
          Invoke-Git -Args @("commit", "-m", "Initial dashboard commit")
      } else {
          & git rev-parse --verify HEAD 2>$null | Out-Null
          if ($LASTEXITCODE -ne 0) {
              Invoke-Git -Args @("commit", "--allow-empty", "-m", "Initial dashboard commit")
          } else {
              Write-Host "No new changes to commit; continuing with existing commit history."
          }
      }

      # 6) Add or update origin remote.
      & git remote get-url origin 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
          Invoke-Git -Args @("remote", "set-url", "origin", $RemoteUrl)
      } else {
          Invoke-Git -Args @("remote", "add", "origin", $RemoteUrl)
      }

      # 7) Prompt for GitHub username and PAT securely.
      $githubUsername = Read-Host "Enter GitHub username"
      if ([string]::IsNullOrWhiteSpace($githubUsername)) {
          throw "GitHub username is required."
      }

      $securePat = Read-Host "Enter GitHub Personal Access Token (repo scope)" -AsSecureString
      $patPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePat)
      $githubPat = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($patPtr)

      if ([string]::IsNullOrWhiteSpace($githubPat)) {
          throw "GitHub PAT is required."
      }

      # 8) Push securely by injecting a temporary auth header (no token stored in git config).
      $authBytes = [Text.Encoding]::ASCII.GetBytes("$githubUsername`:$githubPat")
      $authB64 = [Convert]::ToBase64String($authBytes)

      & git -c "http.extraheader=AUTHORIZATION: Basic $authB64" push -u origin main
      if ($LASTEXITCODE -ne 0) {
          throw "Push failed. Check repository access and PAT scope."
      }

      # 9) Report success.
      Write-Host ""
      Write-Host "Success: Project pushed to GitHub."
      Write-Host "Repository URL: $RemoteUrl"

  }
  catch {
  Write-Error $_
  exit 1
  }
  finally {
  # Best-effort cleanup of sensitive memory.
  if ($patPtr -and $patPtr -ne [IntPtr]::Zero) {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($patPtr)
  }
  $githubPat = $null
  }
