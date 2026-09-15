# DEEP-FEATURES-SAVED-WIP

Status: saved WIP, not release-verified.

This checkpoint records additional product work applied on top of the 1368 saved WIP so the code is not lost if the chat disconnects.

## Added or improved

- Admin token storage moved into a shared frontend auth helper; mutation actions no longer rely on a hardcoded frontend `admin_secret` bearer token.
- First-run bootstrap UI added in Settings for fresh deployments with zero admin keys and a configured `BOOTSTRAP_SECRET`.
- System Readiness endpoint and Settings panel added for keys, providers, models, policies, 24h traffic, errors, blocked requests, and actionable issues.
- Routing Decision Traces page added at `/traces`, backed by `/api/traces` and real routing_decisions records.
- Admin Audit Log page added at `/audit`, backed by `/api/admin/audit-log` and the stored admin token.
- Existing `/metrics` sidebar path now resolves to the live analytics view instead of redirecting away.
- Dashboard, Analytics, Alerts, and Sidebar were cleaned so stale hardcoded operational values are not presented as live facts.
- Alerts view now uses server-derived `/api/alerts` data instead of synthetic timestamps.
- Topology CP02 work remains preserved: no silent node caps, backend-driven payload, internal rail pagination, and 20+/30+ node support through the helper checks.

## Evidence captured

- `static-syntax-check-final.txt`: 50 TS/TSX files checked, 0 syntax errors.
- `topology-runtime-check-final.txt`: 0/1/3/6/10/20/30/37 node layout coverage passed across tested rail heights.
- `feature-smoke-check-final.txt`: 16/16 source-level smoke checks passed.
- `protected-hashes-final.txt`: CP04/CP05 protected router and tests remain byte-identical to the integrated source baseline.

## Known blocked items in this environment

- `npm ci --offline` fails because `yocto-queue-1.2.2.tgz` is not cached.
- A normal `npm ci` attempt did not complete in this sandbox and was killed after timeout.
- `npm test` is blocked because `vitest` is unavailable.
- `npm run build` is blocked because `vite` is unavailable.
- `npm run lint` is blocked by missing dependency/type declarations, not by a completed installed dependency tree.
- Browser runtime verification remains unavailable in this environment.
