# Core Project Identity & Architecture

omniroute-edge is the dedicated Cloudflare Edge and Node.js control, security, and observability plane for OmniRoute.

## Architectural Boundaries

- **Authoritative Routing Plane**: OmniRoute. Cloudflare Edge (worker.ts) and Node server (server.ts) act as an authenticated proxy and observability layer; they do NOT perform upstream provider/model selection, fallback, or retry.
- **Data & Read Model**: Cloudflare D1 (in production edge) and local SQLite via @libsql/client (in Node dev). D1 is a read/telemetry model and credential store, NOT the execution database.

## Major Entry Points

1. **Frontend SPA**: src/main.tsx mounts <App /> from src/App.tsx. All UI views are under src/components/.
2. **Cloudflare Worker Entry Point**: src/worker.ts. Exports default { async fetch(request, env, ctx) }. Handles /v1/* proxying to OMNIROUTE_ORIGIN, asset serving via env.ASSETS, and routes /api/* to the Hono backend.
3. **Node Server Entry Point**: server.ts. Uses @hono/node-server to start Hono on port 3001, initializes the local SQLite read/telemetry database, and serves ./dist for local runtime.
4. **Backend Application**: src/server/app.ts. Hono v4 application defining all REST endpoints (/api/health, /api/readiness, /api/admin/*, /api/providers/*, /api/topology, etc.).
5. **Database Schema**: src/server/db/schema.ts. Drizzle ORM sqliteTable definitions (providers, models, piKeys, policies, 
equests, 
outingDecisions, securityEvents, uditLog, 
equestAttempts).
6. **Tests**: src/server/__tests__/. Vitest tests covering auth, failover, policies, and topology.
7. **Migrations & Config**: drizzle/ (SQL migrations), wrangler.toml (Worker config), ite.config.ts (Vite config), drizzle.config.ts (Drizzle config).

## Source of Truth vs Generated Artifacts

- **Source of truth**: src/**, server.ts, drizzle/**, scripts/**, and configuration files (package.json, 	sconfig.json, ite.config.ts, wrangler.toml, drizzle.config.ts).
- **Generated / Non-source**: dist/** (Vite production build), sqlite.db (local dev DB), logs, and scratch files. Do not edit dist/.