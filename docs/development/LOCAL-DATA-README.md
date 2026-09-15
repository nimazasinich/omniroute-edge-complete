# Local data state

This package is prepared for Windows local development without requiring a live OmniRoute process on `127.0.0.1:20128`.

## Databases

Two SQLite files are intentionally included:

- `sqlite.db` — canonical local runtime/read-model database.
- `OmniRoute-provider-reference.sqlite.db` — synchronized reference copy.

Both databases contain the same provider/model/API-key inventory and the same upgraded telemetry schema. The packaged snapshot contains 26 provider records, 433 model records, and 6 API-key metadata records. The package verifier checks database integrity, table presence, matching provider/model/API-key IDs, and orphan model rows without printing secrets.

Current included facts are whatever is actually present in the source databases. Six provider-connection records have no model rows in the source snapshot; those gaps are preserved rather than filled with invented model associations. No additional requests, provider health, latency, cost, security events, or traffic telemetry are fabricated to make the dashboard look populated.

## Local behavior

The package does **not** ship a private `.env`. `START-LOCAL-PC.cmd` creates a local `.env` from `.env.example` when needed. The generated local configuration uses `SQLITE_DB_PATH=sqlite.db` and leaves `OMNIROUTE_ORIGIN` blank, preventing repeated connection errors to a non-running `127.0.0.1:20128` service. The UI can still use the complete local inventory snapshot.

When a real OmniRoute origin becomes available, set `OMNIROUTE_ORIGIN` to that real origin. Only then is provider health treated as authoritative/live. Imported local health/latency values are exposed as historical snapshot fields, not current health.

## Start

Run:

`START-LOCAL-PC.cmd`

It uses a Windows-local npm cache, installs locked dependencies when needed, verifies both databases, builds the UI, and starts the local server.

You can verify only the data with:

`VERIFY-DATA.cmd`

Do not publish a locally generated `.env` or either database. The two databases are intentionally retained because they are the requested local data snapshots and may contain sensitive credential metadata.
