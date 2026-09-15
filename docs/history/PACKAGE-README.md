# OmniRoute Edge — Complete PC Project Package

This package contains the current OmniRoute Edge source, the synchronized local data snapshot, Windows local-start helpers, and a fail-closed Cloudflare deployment wrapper.

## Local Windows start

Use:

`START-LOCAL-PC.cmd`

The launcher:
- uses a Windows-local npm cache (`%LOCALAPPDATA%\npm-cache`), avoiding transferred VPS/Hermes cache paths;
- restores locked dependencies with `npm ci` when needed;
- verifies both included SQLite databases;
- builds the current UI;
- starts the Node development/runtime server on port 3001.

The included `.env` uses `SQLITE_DB_PATH=sqlite.db` and leaves `OMNIROUTE_ORIGIN` blank until a real OmniRoute runtime/origin exists. This prevents repeated connection failures and keeps local inventory usable without pretending snapshot health is live health.

## Local databases

Two SQLite files are intentionally included:
- `sqlite.db` — canonical local runtime/read-model database.
- `OmniRoute-provider-reference.sqlite.db` — synchronized reference snapshot.

Run `VERIFY-DATA.cmd` or `npm run verify:data` to verify integrity, foreign keys, schema and matching provider/model/API-key inventory IDs. See `LOCAL-DATA-VERIFICATION.md` for the packaged counts and evidence.

## Cloudflare deployment

Use:

`DEPLOY-OMNIROUTE-EDGE-ONECLICK.bat`

The wrapper creates a sanitized temporary staging directory and excludes local `.env`, SQLite databases, generated `dist`, `node_modules`, scratch/recovery material and local logs. It then runs locked dependency restore, TypeScript, Vitest, build, dependency-free contracts, static safety, manifest, and deployment-config verification before invoking Wrangler.

Deployment remains intentionally **blocked** until `wrangler.toml` contains a verified dedicated D1 `database_id` and a real HTTPS `OMNIROUTE_ORIGIN`.

## Architecture contract

- OmniRoute remains the authoritative provider/model routing and fallback plane.
- `src/worker.ts` is the production Cloudflare `/v1/*` edge gateway.
- D1/local SQLite are telemetry/read-model stores, not routing authorities.
- No screenshot/demo values are substituted for missing operational data.
- Snapshot provider health/latency/cost is not presented as live authoritative state.

## Canonical PC project root

`C:\project\OmniRoute_SecureAIRouter_\OmniRoute-Edge-COMPLETE-PROJECT-WITH-DEPLOYER\OmniRoute-Edge-Complete-Project`

## Sensitive local content

The local `.env` and SQLite files may contain credential/configuration material. Keep this PC package private. They are deliberately excluded from Cloudflare deployment staging.
