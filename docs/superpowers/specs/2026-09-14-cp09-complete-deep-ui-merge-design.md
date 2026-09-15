# CP09 Complete Deep UI Merge Design

## Goal
Use OmniRoute-Edge-Deep-UI-Refinement-v2 as the verified baseline, preserve its richer page/detail UI and 54/54 node-test baseline, and merge only the safe, truth-preserving CP08 capabilities that improve authentication, protected navigation, and the normalized `/api/v2` control/read API.

## Architecture
- Keep the Deep UI page implementations, drawers, modals, subtabs, filters, tables, and workspace primitives as the frontend baseline.
- Replace the decorative/timer login flow with server-validated admin-token authentication against `/api/admin/whoami`.
- Protect all dashboard routes with revalidation of the stored admin session; sign-out clears the token.
- Replace timer-only connecting progress with real checks of admin identity, `/api/v2/system/status`, and `/api/system/capabilities` before entering `/`.
- Add CP08 `/api/v2` system/catalog/combo/routing/quota/observability modules only through their service/adapter/repository dependencies. Do not import CP08 retired local router/firewall/policy/health modules.
- Add `routing_decision_index` as an observation/read-model table only; it never selects providers or routes.
- Preserve OmniRoute as the sole routing/provider/model/retry/fallback authority and preserve all unknown/unavailable states.

## UI Contract
- Canonical reference viewport is 1368x753.
- Existing Deep UI refinements remain intact.
- DreamWorker branding is used consistently in auth/loading/application chrome.
- SSO buttons remain visibly unavailable unless a real backend flow exists.

## Safety Contract
- No raw secrets in source, logs, reports, or ZIP.
- No fake health, latency, quota, routing decision, fallback, geo, uptime, threat, or success state.
- `/api/v2` writes remain capability-gated/fail-closed when OmniRoute support is unavailable.
- BLOCKED/SKIP/UNVERIFIED are never PASS.
- Do not ship CP08 `src/server/router.ts`, `health.ts`, `policy.ts`, or `firewall.ts`.

## Acceptance
- Existing Deep UI contract tests remain green.
- New CP09 auth-flow contract tests pass.
- New CP09 v2-integration contract proves route mounting, read-model schema, and absence of retired local authority modules.
- Full node suite passes.
- Safety verifier passes or any genuine blocker is reported exactly.
- If dependencies are available: typecheck, Vitest, and build pass. Otherwise they remain BLOCKED/UNVERIFIED.
