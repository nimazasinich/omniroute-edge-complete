# Phase 0 Baseline And Backlog

Date: 2026-09-14

## Source Of Truth

- Canonical root: `C:\project\OmniRoute_SecureAIRouter_\OmniRoute-Edge-COMPLETE-PROJECT-WITH-DEPLOYER\OmniRoute-Edge-Complete-Project`
- Architecture plan: `docs/architecture/OmniRoute-SecureAI-Router-Deep-Architecture-Upgrade-Plan.md`
- Attached document was treated as target architecture reference, not as independent runtime instructions.

## Baseline Findings

- Git status: BLOCKED. The canonical root is not a Git repository, so `git status` and `git diff` cannot provide a source snapshot.
- Serena: BLOCKED. `.serena/project.yml` exists and names `omniroute-edge`, but Serena MCP tools are not exposed in this session.
- Backend: Hono app in `src/server/app.ts`; Cloudflare Worker entry in `src/worker.ts`; Node server entry in `server.ts`.
- Frontend: React/Vite shell in `src/App.tsx`, with route declarations still centralized there.
- Current frontend routes: `/`, `/topology`, `/providers`, `/models`, `/routing`, `/keys`, `/policies`, `/firewall`, `/logs`, `/analytics`, `/alerts`, `/metrics`, `/traces`, `/audit`, `/settings`, `/signin`, `/connecting`.
- Current backend routes: legacy `/api/*`, admin `/api/admin/*`, and public Worker `/v1/*` gateway.
- Database: SQLite/D1 schema in `src/server/db/schema.ts`; migrations under `drizzle/`; two local DB snapshots are present and preserved.
- Edge hot path: `src/edge/gatewayCore.ts` forwards `/v1/*` to OmniRoute with auth/rate-limit/telemetry, without local provider fallback.
- Legacy risk: `src/server/router.ts`, `src/server/policy.ts`, and excluded tests still contain local provider scoring/failover concepts that must be retired or isolated from production semantics in later phases.
- Verification scripts: `npm run lint`, `npm test`, `npm run build`, `npm run test:node`, `npm run verify:safety`, `npm run verify:data`, `npm run verify:release`.

## Architecture Requirement Matrix

- System layer boundaries: PARTIAL.
- `/api/v2` contracts: PARTIAL, started with system endpoints.
- `ApiEnvelope<T>` and structured error model: PARTIAL.
- `DataProvenance`: PARTIAL.
- Environment identity and mode: PARTIAL.
- Capability registry: PARTIAL.
- OmniRoute version/runtime probe: PARTIAL; currently `/v1/models` probe only, version unknown until a management endpoint is detected.
- Provider/model management adapter: MISSING.
- Combo Studio: MISSING.
- Routing intelligence: PARTIAL, observed request history only.
- Quota/resilience: MISSING.
- Observation data plane: PARTIAL, existing D1 request telemetry only.
- Frontend module registry and TanStack Query ownership: MISSING.
- Flexible dashboards and saved views: MISSING.
- Gateway Profiles: MISSING.
- Cloudflare production Candidate A/B: BLOCKED pending explicit production-evidence phase and approval.

## Implementation Program

- Phase 0: Baseline and delta audit. PARTIAL due unavailable git/Serena; core project map complete enough to start Phase 1.
- Phase 1: Core layer boundaries. IN PROGRESS.
- Phase 2: Provider and model vertical slice. TODO.
- Phase 3: Combo Studio. TODO.
- Phase 4: Routing intelligence. TODO.
- Phase 5: Quota and resilience. TODO.
- Phase 6: Observation plane. TODO.
- Phase 7: Frontend platform layer. TODO.
- Phase 8: Flexible dashboards. TODO.
- Phase 9: Gateway Profiles. TODO.
- Phase 10: Optional OmniRoute modules. TODO.
- Phase 11: Cloudflare production alignment. BLOCKED until evidence and explicit approval.
- Phase 12: Release verification. TODO.

## Phase 1 Slice Completed

- Added shared platform domain contracts.
- Added v2 API envelope helper.
- Added initial OmniRoute management adapter runtime probe.
- Added capability/source/status services.
- Mounted `/api/v2/system/status`, `/api/v2/system/capabilities`, and `/api/v2/system/sources`.
- Added contract tests for v2 system envelopes and capability gates.
