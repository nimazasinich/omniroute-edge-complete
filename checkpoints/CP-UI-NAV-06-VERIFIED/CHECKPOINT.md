# CHECKPOINT: CP-UI-NAV-06-VERIFIED
Date: 2026-09-11
Viewport Target: 1368 × 753 (Strict Canonical Compliance)

## Completed Milestones
1. **CP-UI-NAV-01-SHELL**:
   - Reusable unified `AppShell` (`Sidebar` 116px, `Header` 50px, `main` flex content container).
   - Real URL-driven routing using `react-router-dom` with deep link support, browser back/forward history navigation, and active tab synchronization.

2. **CP-UI-NAV-02-DASHBOARD**:
   - Zero-scroll canonical viewport fit at 1368×753.
   - 6 KPI metric tiles with tabular number formatting and trend badges.
   - 3D glossy AI Router sphere with dynamic SVG percentage connection paths.
   - Live V8 Runtime resources donut gauge and load curve.
   - Recent routing decisions table with real dynamic reasons.
   - Provider health card with ping tests and configuration modal trigger.

3. **CP-UI-NAV-03-TOPOLOGY**:
   - Dedicated interactive AI Topology Workspace (`/topology`).
   - Time window selector (1h, 24h, 7d), status filters (Healthy, Degraded, Offline), and interactive live mesh vs pipeline flow tabs.
   - Interactive Node Inspector: selecting any Ingress Client, Edge PoP, Zero Trust Firewall, AI Router Sphere, or LLM Provider displays real-time telemetry, latency, traffic shares, and configuration controls.

4. **CP-UI-NAV-04-OPERATIONS-PAGES**:
   - **Routing Rules** (`/routing`): Exposes the exact 5-factor scoring engine (40% Health, 25% Latency, 20% Cost, 10% Capability, 5% Priority), dynamic live calculation table for all active providers with rank scoring, and recent decision audits.
   - **API Keys** (`/keys`): Backed by `/api/admin/keys`, supports key creation with one-time raw secret reveal modal and clipboard copy, masked secret storage (`cf-ai...****`), and instant key revocation.
   - **Security Policies** (`/policies`): Backed by `/api/admin/policies`, supports adding and deleting governance rules (model allowlists, provider denylists, IP rate limits, token budgets).
   - **AI Firewall** (`/firewall`): Security operations workspace with interactive threat simulator (tests live against `/v1/chat/completions` for instant BLOCK / WARN feedback), severity filtering, and full security event log.
   - **Logs** (`/logs`): Inference request audit viewer with client search, HTTP status filters (200, 403, 500), provider filters, prompt/completion token counts, cost calculation, and latency metrics.
   - **Analytics** (`/analytics`): Telemetry charts for throughput (req/sec), 24h traffic & latency curves, provider traffic share distribution, and edge V8 memory pool usage.
   - **Alerts** (`/alerts`): Real-time synthesized notifications from provider health checks and firewall blocks with severity badges and deep-link investigation actions.
   - **Settings** (`/settings`): Read-only mathematical engine weights clearly distinguished from edge configuration constants (failover cutoff 2000ms, ping interval 60s, strict firewall enforcement).
   - **Providers & Models** (`/providers`, `/models`): Secondary status filter tabs, search filter, live ping probe, and editing modals.

5. **CP-UI-NAV-05-RESPONSIVE**:
   - Strict 1368×753 viewport fit tested without horizontal or whole-page vertical scrollbars.
   - Internal scrolling provided for data-dense tables.

6. **CP-UI-NAV-06-VERIFIED**:
   - Lint check passed (`npm run lint` -> zero errors).
   - Production compilation verified (`compile_applet` -> build succeeded).
   - Dev server restarted and fully operational.
