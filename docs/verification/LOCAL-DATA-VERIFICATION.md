# Local Data Verification

Generated: 2026-09-14

## Result

**PASS for the packaged local data snapshot.** Both SQLite files are readable, internally consistent, use the upgraded request-telemetry schema, and carry matching provider/model/API-key inventory IDs.

## Included database facts

### `sqlite.db`

- SHA-256: `0c4e2c899952377fca70d4edc3e774238f9727b79124eb21f22ff9615d98f95b`
- integrity_check: `ok`
- foreign-key violations: `0`
- providers: `26`
- models: `433`
- api_keys: `6`
- provider credentials configured: `24/26`
- gateway API-key metadata: `5`
- admin API-key metadata: `1`
- requests: `2`
- security_events: `1`

### `OmniRoute-provider-reference.sqlite.db`

- SHA-256: `0c4e2c899952377fca70d4edc3e774238f9727b79124eb21f22ff9615d98f95b`
- integrity_check: `ok`
- foreign-key violations: `0`
- providers: `26`
- models: `433`
- api_keys: `6`
- provider credentials configured: `24/26`
- gateway API-key metadata: `5`
- admin API-key metadata: `1`
- requests: `2`
- security_events: `1`

## Inventory completeness

- The two packaged databases currently have matching provider/model/key inventory IDs.
- Provider inventory: **26** records.
- Model inventory: **433** records.
- API-key metadata inventory: **6** records.
- Encrypted provider credential presence: **24/26** provider rows.
- No raw provider credential, API-key hash, or raw gateway/admin key is exposed by the UI inventory surfaces.
- No orphan model rows exist.
- Six provider-connection records have no model rows in the source snapshot. They are preserved exactly; no model associations are invented.

## Provenance rules

- Live OmniRoute remains authoritative for runtime provider/model state when available and validated.
- Local inventory fallback is reference/snapshot data and must not masquerade as live health.
- Snapshot health/latency/success/cost is not promoted to authoritative live state.
- API-key workspace may expose masked metadata only after admin authorization; readiness counts may be shown without revealing secret material.
- Cloudflare edge evidence and local runtime evidence remain separate.

## Fresh verification evidence

- Dependency-free Node suite: **51/51 PASS, 0 failed, 0 skipped**.
- `npm run verify:data`: **PASS**.
- `ALLOW_LOCAL_DATA_BUNDLE=1 npm run verify:safety`: **PASS**.
- TypeScript/TSX syntactic transpile: **PASS (57 files)**.

Dependency-backed lint/Vitest/Vite build are not claimed in this container because exact dependency restore is blocked by npm-registry connectivity. Run `VERIFY-AND-BUILD.cmd` on the target Windows PC for the complete dependency-backed gate.
