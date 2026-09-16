# Vercel-native OmniRoute Design

## Goal
Run the existing OmniRoute Edge application and OmniRoute 3.8.50 on the existing Vercel project, removing Render from the active runtime path while preserving OmniRoute as the sole provider/model/routing/retry/fallback authority.

## Architecture
Vercel serves the existing SPA, browser auth, `/api/*`, and `/v1/*` from the existing Node entrypoint. A Vercel container (`Dockerfile.vercel`) packages Node 24, the existing app, and a pinned global `omniroute@3.8.50`. The Node server starts the OmniRoute child on loopback-only internal ports and forwards `/v1/*` through the existing `gatewayCore` directly to the OmniRoute API bridge. No provider/model routing logic is added to the control plane.

Turso is used only for application-owned control-plane/auth/telemetry state through the existing `@libsql/client` path. OmniRoute's own SQLite state remains local/ephemeral inside the Vercel runtime unless upstream OmniRoute gains a supported remote storage adapter.

## Runtime boundaries
- Public Vercel listener: `$PORT`, host `0.0.0.0`.
- OmniRoute dashboard/internal server: `127.0.0.1:20129`.
- OmniRoute API bridge: `127.0.0.1:20130`.
- `/v1/*` keeps existing gateway authentication, request IDs, streaming, honest telemetry, and `X-Routing-Authority: omniroute`.
- Embedded runtime uses the existing `OMNIROUTE_API_KEY` to authenticate the local gateway-to-runtime hop.
- Missing required runtime secrets fail closed; no fabricated readiness or provider status.

## Persistence
When both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are present, the Node control-plane DB uses remote libSQL/Turso. Without `TURSO_DATABASE_URL`, local development keeps the current SQLite file behavior. A configured Turso URL without its auth token is a configuration error.

## Deployment
The connected GitHub repository remains the deployment source. Work is developed on `vercel-native-runtime`; Vercel Preview deployments are expected on branch pushes. `main` is not modified until branch CI and Vercel runtime evidence are acceptable.

## Verification
Required evidence before promotion: source tests, TypeScript, Vite build, Node contract tests, container build contract, Vercel Preview build status, `/signin`, `/api/health`, browser session flow, authenticated `/v1/models`, and streaming chat when a real provider is configured. `BLOCKED`, `SKIP`, and `UNVERIFIED` are never reported as PASS.
