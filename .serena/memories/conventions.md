# Project Conventions & Guidelines

## Code Organization

- `src/components/`: React dashboard/control/observability views.
- `src/server/app.ts`: Hono REST/read-model API for the local Node runtime and Worker API surface.
- `src/server/db/`: Drizzle schema and D1/local SQLite adapters.
- `src/edge/`: Cloudflare gateway authentication, origin validation, rate limiting and truthful D1 telemetry.
- `src/worker.ts`: authoritative production `/v1/*` edge gateway.
- `src/topology/`: read-only topology payload/layout derived from observed data.
- `test-node/`: dependency-free architecture, safety, UI-truth and deployment-contract tests.

## Rules & Safety Constraints

- OmniRoute is the sole provider/model routing and fallback authority.
- Do not restore the retired local `router.ts`, `policy.ts`, `health.ts`, or `firewall.ts` execution modules.
- Cloudflare D1 and local SQLite are telemetry/read-model stores, not routing authorities.
- Local provider inventory can be used as a snapshot when OmniRoute is unavailable, but snapshot health/latency/cost must never be presented as live authoritative state.
- No mock/demo/random operational values. Unknown data stays `Unknown`, `No data`, or `—`.
- Raw API credentials must never be logged or returned to unauthenticated clients.
- Keep `node_modules`, generated `dist`, local `.env`, SQLite files and raw credential dumps out of sanitized Cloudflare release staging.
