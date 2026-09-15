# Canonical V3.2 Verification Summary

Verification date: 2026-09-13

## PASS — fresh source-level evidence

- `npm run test:node`: **40 tests, 40 passed, 0 failed, 0 skipped**.
- `npm run verify:safety`: **PASS**; scanned source/package tree and local-import integrity.
- TypeScript/TSX parser gate: **46 files, 0 syntax diagnostics**.
- Deploy-config behavioral contract: source placeholders fail closed; a temporary verified-shaped D1 ID + HTTPS origin configuration passes.
- UI truthfulness contracts cover screenshot-metric rejection, read-only provider/model/routing surfaces, no fake prompt-firewall claim, observed-only logs/traces, alert unavailable-vs-empty distinction, no invented environment/operator identity, and topology controls/capability badges that reflect implemented behavior.
- Gateway contracts cover auth, rate-limit fail-closed behavior, 429 handling, origin validation, credential stripping, request/correlation IDs, streaming passthrough, honest 502 behavior, requested-model observation and D1 telemetry with no fabricated provider/selected-model/token/cost values.

Evidence files:

- `verification/V3.2-node-tests.log`
- `verification/V3.2-static-safety.log`
- `verification/V3.2-ts-syntax.log`

## EXPECTED FAIL-CLOSED — deployment placeholders

`npm run verify:deploy-config` currently exits non-zero because the replacement source intentionally ships with:

- zero UUID D1 `database_id` placeholder;
- empty `OMNIROUTE_ORIGIN`.

This is required replacement safety, not a deploy PASS. Evidence: `verification/V3.2-deploy-config-source.log`.

## BLOCKED — dependency-backed build gates

`npm ci --offline` exits `1` with `ENOTCACHED`: `yocto-queue-1.2.2.tgz` is absent from the packaging environment's npm cache. Earlier bounded online restore attempts timed out in this environment.

Because exact dependency restore is not available here, these gates are **BLOCKED and not reported as PASS**:

- project `tsc --noEmit` with installed dependencies;
- Vitest suite;
- Vite production build;
- fresh React runtime screenshot from the V3.2 source.

Evidence: `verification/V3.2-npm-ci-offline.log`.

## UNVERIFIED — target deployment environment

- actual Cloudflare D1 ID/resource ownership;
- D1 migration application against the target database;
- Cloudflare Access policy;
- Tunnel/VPS connectivity;
- live Worker version identity;
- live OmniRoute request/stream response;
- real OmniRoute provider selection/fallback behavior;
- production D1 telemetry/dashboard readback;
- post-deployment rate-limit and auth behavior.

These require the target environment and must remain UNVERIFIED until real evidence exists.

`BLOCKED`, `SKIP`, and `UNVERIFIED` are never PASS.
