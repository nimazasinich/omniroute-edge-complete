# OmniRoute Edge Secondary Pages Completion Design

## Goal
Complete every secondary UI page in the existing OmniRoute Edge dashboard without replacing the current dashboard, login/loading work, or inventing operational data.

## Source of Truth
- Working snapshot: `OmniRoute-Edge-PC-Complete-V2`
- Canonical PC root when applied by the user: `C:\project\OmniRoute_SecureAIRouter_\OmniRoute-Edge-COMPLETE-PROJECT-WITH-DEPLOYER\OmniRoute-Edge-Complete-Project`
- Existing backend/API contracts in `src/server/app.ts`, `src/worker.ts`, D1 telemetry, and SQLite read models.
- Existing visual language in `DashboardView`, `AppShell`, `Header`, `Sidebar`, and `src/index.css`.

## Scope
Complete and normalize these routes/pages:
- Providers
- Models
- Routing Rules / Routing Status
- API Keys
- Security Policies
- AI Firewall / Security Events
- Logs
- Metrics (new dedicated view; no longer an Analytics alias)
- Traces
- Analytics
- Alerts
- Audit Log
- Settings
- Topology polish where needed for consistency

## Architecture
Keep the current React/Vite/Hono structure. Reuse existing page components and data already normalized in `App.tsx`; add small focused shared UI primitives only where repeated page behavior warrants it. No second router, no local routing authority, and no new mock data layer.

The backend remains authoritative only for what it actually observes or stores. Provider/model inventory may come from OmniRoute when configured, otherwise from the local snapshot database. Telemetry pages use observed request/security/trace/audit records. Any unavailable field renders as `—`, `Unknown`, `Not observed`, `Not configured`, or `Unavailable` rather than a fabricated value.

## Data Provenance Rules
1. OmniRoute remains the only routing authority.
2. Provider/model snapshot fallback is inventory metadata, not proof of live health.
3. Health, latency, traffic, cost, geo, security posture, and runtime state must be tied to an explicit real source.
4. Local Node runtime metrics must be labeled local Node/runtime, never Cloudflare production metrics.
5. Security-event absence must not be rendered as “secure” or “healthy”.
6. No synthetic trends, fake percentages, decorative geographic traffic intensity, fake costs, or fake routing decisions.
7. Read-only pages must clearly say so when no real management API exists.

## Page Design
Each secondary page uses the same hierarchy:
- compact title/status row with source/read-only badges where applicable;
- summary/KPI row derived only from real data;
- primary workspace card with search/filter/sort controls;
- dense but readable table/list/detail area;
- explicit loading, empty, degraded, and error states;
- provenance note for fields whose authority can be misunderstood.

### Providers
Show the complete provider inventory, enabled state, real/snapshot health provenance, observed 24h request counts, latency/success only when available, base URL/metadata where safe, and search/status/source filters. Never infer health from provider existence.

### Models
Show all models (expected snapshot inventory is 433), provider mapping, active state, context window/capabilities when present, and cost only if present in authoritative data. Include provider/search/capability filters and totals.

### Routing
Show observed routing decisions/status and OmniRoute connectivity/readiness. Configuration controls remain disabled/read-only unless an actual management endpoint exists. No local weight/failover simulation.

### API Keys
Preserve existing secure behavior. Improve hierarchy, filtering, status/readiness context, and safe metadata display. Secret material is never displayed after creation.

### Security Policies / Firewall
Separate configured policy metadata from observed security events. If enforcement capability is unavailable, show that explicitly. Event counts/severity come only from stored telemetry.

### Logs / Traces / Audit
Use real observed records with time/status/type/provider/correlation filters, pagination where already supported, useful detail drawers/cards, and honest empty states.

### Metrics
Create a dedicated `MetricsView` using real analytics/runtime/telemetry fields. Metrics unavailable from the current runtime remain unknown. `/metrics` must no longer render `AnalyticsView`.

### Analytics
Keep aggregate request/provider/security analysis, improve charts/tables only where backed by returned series. No invented trend deltas.

### Alerts
Use real operational alerts/readiness issues only. No synthetic incident feed.

### Settings
Present actual connectivity, runtime/data-source posture, browser-local admin token state, readiness, and capabilities. Avoid presenting unsupported settings as configurable.

## Shared UI
Add only small reusable pieces if necessary, such as:
- `PageHeader`
- `SourceBadge`
- `EmptyState`
- `MetricTile`
- table/filter helpers

Do not introduce a new component framework or broad visual rewrite.

## Routing Changes
Add a dedicated `/metrics` route/component. Preserve all current route names and sidebar destinations unless a broken alias must be corrected. Navigation state must remain consistent with the header/sidebar.

## Error Handling
- API failure: retain page shell and show source-specific error/degraded state.
- Empty datasets: show “No observed data” instead of zero when zero would imply measurement.
- Origin unavailable: inventory fallback may still render, but health authority must remain false/unknown.
- Partial fields: render field-level unknown values, not placeholders that look measured.

## Testing and Acceptance
Acceptance requires:
1. every sidebar destination renders a purpose-built page;
2. `/metrics` is independent from Analytics;
3. providers/models display the complete available inventory from the local DB fallback when OmniRoute origin is disabled;
4. no secondary page contains hard-coded operational KPI values presented as live data;
5. provenance/read-only semantics remain truthful;
6. browser navigation has no console-breaking runtime errors;
7. existing contract tests are preserved and extended rather than removed to force green;
8. `npm test`, `npm run test:node`, and `npm run build` pass, with any environment/deploy-config blockers reported separately;
9. final package excludes secrets and stale `node_modules`/build artifacts unless intentionally generated.

## Non-Goals
- Re-implementing OmniRoute routing/failover inside the dashboard.
- Fabricating missing live telemetry.
- Replacing the approved Dashboard/Login/Loading visual work.
- Adding new provider protocols or unsupported control-plane APIs.
- Making deployment claims when production origin/D1 configuration is not actually verified.

## Delivery
Produce an updated full PC package plus a concise change/verification report. Preserve the two verified databases and their provider/model inventory. Any operational field not supported by source data remains visibly unknown.
