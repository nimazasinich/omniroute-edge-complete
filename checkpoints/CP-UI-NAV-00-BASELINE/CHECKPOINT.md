# CHECKPOINT: CP-UI-NAV-00-BASELINE
Date: 2026-09-11
Viewport Target: 1368 × 753

## Baseline State Summary
- **Compilation Status**: SUCCEEDED (Vite + TSX Node server).
- **Lint Status**: PASSED (zero TypeScript/ESLint warnings or errors).
- **Active Working Backend APIs**:
  - `GET /api/health` -> `{"status":"ok"}`
  - `GET /api/admin/dashboard/stats` -> Live counts of total requests, active/degraded/offline providers, avg latency, blocked threats.
  - `GET /api/admin/providers` -> Returns safe provider definitions with dynamic latency and ping status.
  - `PUT /api/admin/providers/:id` -> Updates provider name, baseUrl, priority, status, enabled, and metadata.
  - `POST /api/admin/providers/ping` -> Triggers real health check network requests.
  - `GET /api/admin/models` -> Returns models joined with provider info.
  - `GET /api/admin/logs` -> Returns stored request logs (last 100 entries).
  - `GET /api/admin/policies` -> Returns configured security policies.
  - `POST /api/admin/policies` -> Inserts new security policies.
  - `GET /api/admin/routing/history` -> Returns recent 20 routing decisions from SQLite `logs`.
  - `GET /api/admin/security/events` -> Returns recent security events from `security_events`.
  - `GET /api/admin/analytics` -> Returns runtime V8 memory & CPU metrics.
  - `GET /api/admin/topology` -> Returns traffic topology structure.
  - `POST /v1/chat/completions` -> Evaluates prompt injection, routes through 5-factor scoring engine, proxies or generates completion, and logs result.
- **Frontend Current Routes**:
  - React Router (`BrowserRouter`) in `src/App.tsx`, but active tab was tracked in React state (`activeNav`) rather than real path-based routes (`/`, `/topology`, `/providers`, etc.).
- **Known Baseline Deficiencies to Address**:
  - Sidebar menu items ('Routing Rules', 'API Keys', 'Security Policies', 'AI Firewall', 'Logs', 'Analytics', 'Alerts', 'Settings') do not yet have dedicated full-featured operational pages.
  - AI Topology view was embedded directly in the dashboard or rendered only the raw map without operational filters, inspector sidebar, node detail panels, or flow diagnostics.
  - Navigation did not update browser URL (`/providers`, `/models`, etc.) or support browser history back/forward or deep-link reload.
  - Viewport fit at 1368×753 requires precise enterprise geometry to prevent whole-page scroll while allowing internal card scrolling.
