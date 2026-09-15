# OmniRoute + DreamWorker — Merged Complete Project

Status date: 2026-09-14

## Merge policy

This source tree is a superset merge of the two owner-supplied packages:

1. `OmniRoute-SecureAI-Router-DreamWorker-FULL-PROJECT-2026-09-14.zip` — primary source of truth for runtime gateway behavior, browser authentication, OAuth/session handling, CSRF protection, Worker/Node environment contract, and existing V3.2 operational surfaces.
2. `OmniRoute-DreamWorker-CP10-Complete-OwnerBackend-CP08Auth-CP09UI.zip` — source for DreamWorker UI branding/connecting experience and normalized API v2/domain/service/integration architecture.

## Conflict resolution

- Browser authentication: kept the newer server-side browser-session design from source 1. The older local admin-token-only browser flow from source 2 was **not** allowed to replace it.
- UI: retained the shared Deep UI surfaces and adopted DreamWorker header branding plus the richer CP10 connecting experience, wired to the real browser session/workspace/permission checks.
- API v2: merged CP10 system/catalog/combo/routing/operations/observability modules into the source-1 Hono app.
- API v2 security: v2 now inherits source-1 authentication and also uses `adminAuthMiddleware`; browser mutations require CSRF proof while admin API keys remain supported.
- Database schema: both browser-auth tables and the observation-only `routing_decision_index` are present.
- Migration collision: source 1 keeps `0004_browser_auth.sql`; source 2 `0004_routing_decision_index.sql` is renumbered to `0005_routing_decision_index.sql`.
- Routing authority: OmniRoute remains the only provider/model/fallback authority. The routing decision index is observation-only.
- Worker/Node env: source-1 auth/OAuth environment bindings are preserved.

## Verification rule

`BLOCKED`, `SKIP`, and `UNVERIFIED` are not PASS. See `../verification/MERGED-VERIFICATION.md` for the exact checks run on this merged tree.
