# OmniRoute Edge — Canonical V3.2

OmniRoute Edge is the Cloudflare gateway/control/observability layer in front of a separate OmniRoute instance. The React dashboard follows the approved visual composition in `docs/reference/target-dashboard.png`, while operational data remains evidence-based.

## Core contract

- **OmniRoute is the only routing/fallback authority.**
- `src/worker.ts` is the only production `/v1/*` gateway.
- The edge authenticates, rate-limits, validates origin configuration, sets request/correlation IDs, writes honest D1 telemetry, and transparently streams the upstream response.
- The edge does not choose providers/models or implement provider retry/fallback.
- Unknown provider/model/health/token/cost facts remain unknown; screenshot values are never substituted.
- Provider/model snapshot tables are explicitly labelled as snapshots and are read-only from the dashboard.

## V3.2 surfaces

Dashboard, topology, providers, models, routing status, API keys, security enforcement inventory, security-event explorer, logs, metrics/analytics, traces, alerts, audit log and settings are present. Unsupported capabilities are displayed as not connected/not integrated rather than simulated.

Important operational endpoints:

- `/api/system/capabilities` — declared runtime capability/source contract.
- `/api/omniroute/status` — bounded real probe of the configured OmniRoute `/v1/models` surface.
- `/api/logs`, `/api/traces`, `/api/analytics`, `/api/alerts` — D1-backed observed edge data.

## Browser entry flow

The UI now uses a real authenticated entry pipeline:

```text
/signin -> POST /api/auth/login -> revocable server session -> /connecting
        -> session check -> workspace/readiness probes -> permission check -> dashboard
```

- Browser passwords are stored only as bcrypt hashes in `auth_users`.
- Session and CSRF tokens are random opaque values; only their hashes are stored server-side.
- `dw_session` is HttpOnly and becomes Secure automatically on HTTPS; the readable `dw_csrf` cookie is double-submitted as `X-CSRF-Token` on browser mutations.
- Failed password logins are rate-limited.
- First administrator creation is fail-closed and requires either explicit `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD` or `BOOTSTRAP_SECRET` through the first-time setup dialog. No default password exists.
- Google/GitHub/Microsoft buttons are disabled unless their client ID and secret are configured. Google/GitHub account linking requires a provider-verified email. New OAuth users are disabled by default unless `AUTH_OAUTH_AUTO_PROVISION=true` and their email domain is listed in `AUTH_ALLOWED_EMAIL_DOMAINS`.
- All dashboard/control-plane API routes require an authenticated browser admin session or a valid existing admin API key. `/v1/*` keeps its separate gateway-key contract.

Cloudflare deployment must apply `drizzle/0004_browser_auth.sql` before browser login is used. Configure secrets with Wrangler/Cloudflare secret bindings; do not commit them into `.env` or `wrangler.toml`.


## Merged DreamWorker + API v2 delivery (2026-09-14)

This package is the superset merge of the complete Secure AI Router project and the CP10 DreamWorker UI/control-plane project. It keeps the server-side browser session/OAuth/CSRF authentication pipeline while adding the CP10 normalized `/api/v2` system, catalog, Combo, routing, operations, and observability architecture. The DreamWorker application chrome and richer connecting screen are wired to the real server-session checks rather than the older local token-only flow.

Migration order is now `0004_browser_auth.sql` followed by `0005_routing_decision_index.sql`; the routing-decision index is observation-only and does not become routing authority. See `docs/history/MERGED-PROJECT-DELIVERY.md` and `docs/verification/MERGED-VERIFICATION.md`.

## Local verification

Requires Node.js 22+ and npm registry access.

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:node
npm run verify:safety
npm run manifest
```

Windows replacement users can run:

```bat
VERIFY-AND-BUILD.cmd
```

Before deployment, configure the real D1 ID and HTTPS OmniRoute origin, then run:

```bash
npm run verify:deploy-config
```

The replacement package intentionally excludes `node_modules` and stale `dist`; build output must be generated from this exact source.

See `docs/development/PROJECT-STATE.md`, `docs/development/REPLACE-INSTRUCTIONS.md`, and `docs/verification/V3.2-ACCEPTANCE.md` for evidence and remaining deployment gates.

### Local Windows recovery

Run `START-LOCAL-PC.cmd` after transferring this project to Windows. It uses a local npm cache, verifies both SQLite databases, builds the current UI, and starts the Node development server on port 3001. See `docs/development/LOCAL-DATA-README.md` for database provenance and live-vs-snapshot semantics.
