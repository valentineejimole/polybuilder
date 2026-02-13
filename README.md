# Polymarket Builder-Routed Trades Dashboard

Next.js + Prisma dashboard for builder-attributed trades using Polymarket CLOB Builder Methods (`getBuilderTrades`).

## Stack

- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- `@polymarket/clob-client` with builder auth (`BuilderConfig`)

## Required Environment Variables

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/polybuilder?schema=public"
CLOB_HOST="https://clob.polymarket.com"
POLY_BUILDER_API_KEY=""
POLY_BUILDER_SECRET=""
POLY_BUILDER_PASSPHRASE=""
POLY_BUILDER_ADDRESS=""
TIMEZONE="UTC"
```

Notes:
- `POLY_BUILDER_*` must be valid builder credentials.
- Secrets are server-only; no browser exposure.
- Restart the dev server after changing `.env`.

## Setup

```powershell
npm install
npx prisma migrate dev
npm run dev
```

Open:
- `http://localhost:3000/dashboard`
- `http://localhost:3000/settings`

## API

- `GET /api/connection`
  - Validates builder auth in `mode: "builder"`.
- `POST /api/sync`
  - Syncs builder-attributed trades via `client.getBuilderTrades(...)`.
  - Idempotent upsert by unique trade `id`.
  - Uses cursor-only pagination (`next_cursor`).
  - If no trades are returned, it still returns success with `0 builder trades`.
- `GET /api/trades`
  - Filtered/paginated trade data for UI.
- `GET /api/trades?format=csv`
  - CSV export including `size_usdc` and total builder volume column.

## Data Model

`Trade` stores builder fields:
- `id` (unique)
- `builderApiKey`
- `walletAddress`
- `market`
- `assetId`
- `side`
- `sizeUsdc` (used for volume)
- `matchTime`
- `transactionHash`
- `rawJson`

`SyncState` stores:
- `lastSyncedMatchTime`
- `lastSyncedCursor`
- `lastRunAt`

## Builder Auth Troubleshooting (401)

Common causes:

1. Wrong builder credentials (`POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, `POLY_BUILDER_PASSPHRASE`).
2. Environment changes not loaded (restart `npm run dev`).
3. Clock skew on local machine (check system time/NTP; API errors include `clockSkewSeconds` when available).
4. Wrong host (`CLOB_HOST` should usually be `https://clob.polymarket.com`).

Error responses include HTTP status and a server-side `correlationId` to match logs.

## Windows PowerShell Smoke Test

Script: `scripts/smoke-test.ps1`

Runs:
1. `npm install` (if needed)
2. `npx prisma migrate deploy`
3. starts dev server in background (unless `-SkipServerStart`)
4. calls:
   - `GET /api/connection`
   - `POST /api/sync`
   - `GET /api/trades?page=1&pageSize=5`
   - `GET /api/trades?format=csv&page=1&pageSize=50` -> `trades.csv`
5. verifies non-401 path and CSV creation

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

If you already started dev server manually:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -SkipServerStart
```

## Local Postgres Quickstart

Use any Postgres provider locally (Docker, Neon, Supabase, local Postgres server):

1. Set `DATABASE_URL` in `.env` to your Postgres connection string.
2. Run:
```powershell
npm install
npx prisma migrate dev
npm run dev
```
3. Verify:
```powershell
curl http://localhost:3000/api/trades
curl -X POST http://localhost:3000/api/sync
```

## Vercel Deployment Env Vars

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL` (`postgresql://...`)
- `POLY_BUILDER_API_KEY`
- `POLY_BUILDER_SECRET`
- `POLY_BUILDER_PASSPHRASE`
- `CLOB_HOST` (recommended: `https://clob.polymarket.com`)
- Optional: `POLY_BUILDER_ADDRESS`

Build behavior:
- `npm run build` runs Prisma generate and Prisma migrate deploy before Next build.
- `prisma migrate deploy` is safe and idempotent for repeated deploys.
- `scripts/prisma-sanity-check.cjs` fails the build if schema/provider/env var wiring is invalid.

## Vercel Checklist

1. Add `DATABASE_URL` (Postgres) in Vercel.
2. Add `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, `POLY_BUILDER_PASSPHRASE`, and `CLOB_HOST`.
3. Optional: add `POLY_BUILDER_ADDRESS`.
4. Redeploy and uncheck **Use existing Build Cache** to avoid stale Prisma client artifacts.
