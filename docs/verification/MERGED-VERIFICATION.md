# OmniRoute + DreamWorker Merged Verification

Verification date: 2026-09-14

This report applies to the merged source tree `OmniRoute-DreamWorker-MERGED-COMPLETE-2026-09-14`.

## PASS — dependency-free / source-level verification

- `npm run test:node`: **62 passed, 0 failed, 0 skipped** after updating the inherited visual contract to the selected DreamWorker header branding and fixing the merge-specific SQL regex test.
- `npm run verify:data`: **PASS**.
  - providers: 26
  - models: 433
  - API keys: 6
  - provider credentials configured: 24/26
  - gateway API-key metadata: 5
  - admin API-key metadata: 1
  - observed requests: 2
  - security events: 1
  - both bundled databases passed integrity/foreign-key checks and matched provider/model/key inventory IDs.
- `ALLOW_LOCAL_DATA_BUNDLE=1 npm run verify:safety`: **PASS**.
- TypeScript parser syntax pass using TypeScript 5.8.3: **91 TS/TSX files, 0 syntax diagnostics**.
- Merge coverage check: all **26** CP10 v2/domain/service/integration runtime modules are present and hash-identical to source 2.
- Auth/runtime preservation check: **6/6** selected source-1 authority files are hash-identical (`AuthProvider.tsx`, `browserSession.ts`, `browserAuth.ts`, `0004_browser_auth.sql`, `server.ts`, `worker.ts`).
- Migration collision resolved: browser auth remains `0004_browser_auth.sql`; routing decision index is `0005_routing_decision_index.sql`.
- Source package hygiene: no packaged `node_modules`, `dist`, `.wrangler`, or `.env`.

## Expected fail-closed deployment check

`npm run verify:deploy-config` exits non-zero by design in the delivered source because production deployment values are not fabricated:

- D1 `database_id` is still the fail-closed placeholder.
- `OMNIROUTE_ORIGIN` is empty.

This is **not** reported as PASS and must be resolved with real deployment values before Cloudflare deployment.

## BLOCKED — dependency-backed verification

`npm ci` timed out in this execution environment. `npm ci --offline` also failed with `ENOTCACHED` because `zod-3.25.76.tgz` was not present in the npm cache.

Therefore the following are **not claimed as PASS** on this machine:

- `npm run lint` / full `tsc --noEmit` with project dependencies installed;
- `npm test` / Vitest runtime suites;
- `npm run build` / Vite production build;
- browser runtime / exact 1368×753 screenshot verification;
- Cloudflare deployment/runtime verification.

A probe after the failed dependency install confirmed the failures were dependency-availability failures (`react`, `hono`, `drizzle-orm`, `@types/node`, `vitest`, `vite`, etc. unavailable), not a legitimate completed type/build run.

`BLOCKED`, `SKIP`, and `UNVERIFIED` are never PASS.
