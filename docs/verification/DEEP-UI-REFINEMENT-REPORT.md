# OmniRoute Edge — Deep UI Refinement Report

Date: 2026-09-14
Reference viewport: 1368 × 753
Reference design: Cloudflare AI Router Transparent DesignSpace v2
Scope: deep UI/UX refinement on the existing codebase; no replacement routing engine and no production Cloudflare mutation.

## Architecture invariants preserved

- OmniRoute remains the only routing/execution authority.
- Secure-AI-Router remains the control plane and operator UI.
- D1/local SQLite remain observation/reference stores, never routing authorities.
- Missing operational evidence remains Unknown / Unavailable / Not observed / Not configured.
- No provider health, Cloudflare geography, routing winner, quota balance, fallback attempt, cost, latency, alert, or identity is fabricated.
- Provider credentials and raw API secrets are never exposed by the UI.

## Global shell

### Header
- Reference-board search wording restored.
- Command palette added with Ctrl/Cmd+K.
- Environment popover added; no fake environment switching.
- System health popover added from actual readiness/origin data.
- Notifications popover added from observed alert response.
- Account popover explicitly avoids asserting an operator identity.
- Refresh control retained.

### Sidebar
- Navigation organized into Overview / Operate / Observe / Configure / System.
- Sections are independently collapsible.
- Existing route coverage is preserved.
- Gateway status remains source-aware and does not infer live provider health from snapshots.

### Shared interaction primitives
- Added one shared InspectorDrawer.
- Added one shared ModalDialog.
- Added WorkspaceTabs.
- Added SourcePill and ProgressBar.
- Added DetailGrid / DetailItem.
- Escape and backdrop close behavior centralized.

## Dashboard
- Six KPI cards retain the supplied reference-board composition.
- KPI cards are keyboard-accessible drill-down controls.
- Dashboard detail modal explains data source and available facts.
- Runtime Resources now opens a runtime detail modal.
- Recent Edge Requests links to the complete Logs workspace.
- Provider summary still shows only six rows but discloses `Showing 6 of N` and links to the full inventory.
- Geographic card remains explicitly unavailable until real Cloudflare region/colo telemetry exists.

## Providers
- Entire provider inventory remains reachable; no silent truncation.
- Search, filtering, status/source information retained.
- Traffic share now has a visual progress bar based only on observed traffic.
- Provider rows open a Provider inspector.
- Inspector tabs: Overview / Models / Health / Traffic / Credentials / Configuration / History.
- Credentials tab shows presence/metadata only, never raw secrets.
- Snapshot health is not relabeled as live health.
- Mutation controls remain unavailable until authoritative management-write capability is verified.

## Models
- Full 433-model inventory remains accessible with pagination.
- Provider/capability/search filters retained and refined.
- Capability chips added.
- Context-window visualization added from stored metadata.
- Pricing formatted as metadata rather than operational spend.
- Model inspector added.
- Up to five models can be selected for a comparison modal.
- Snapshot availability is not converted into runtime readiness.

## Routing Status
- Added Observed outcomes / Request distribution / Explainability tabs.
- Request-type distribution is derived from observed rows.
- Error-only filtering added.
- Outcome detail drawer added.
- OmniRoute 3.8.50 limitations are explicit: no request-specific decision endpoint and no Auto candidate read surface.
- No local score/winner/fallback reconstruction exists.
- Fixed a real backend wiring defect: `/api/routing/history` now selects `requests.observedCost`, not legacy default-zero cost.
- Added a regression contract that rejects `requests.cost` on this route.

## API Keys
- Gateway/Admin tabs added.
- Database inventory counts remain distinct from authorized key-list access.
- Last-used field renders only when observed; otherwise `Not observed`.
- Key metadata inspector added.
- Native confirm flow removed.
- Create, revoke confirmation, and one-time secret reveal use styled dialogs.
- Raw secret is shown only from the one-time creation response and is never persisted in browser-readable metadata.
- Admin authorization failure is distinct from an empty key database.

## Security Policies
- Capability coverage is visualized without calling it a security posture score.
- Capability cards remain driven by actual capability data.
- Capability detail drawer added.
- Observed security evidence uses structured rows.
- Deployment readiness is visually actionable.
- No last-enforcement timestamp is fabricated.
- Security Event drill-down path is provided.

## Security Events
- Events / Breakdown / Top sources tabs added.
- Severity distribution is calculated from stored events.
- Top source counts are calculated from stored events.
- Event detail drawer added.
- No fake time-series chart is generated when historical buckets do not exist.
- No local prompt-firewall claim is introduced.

## Logs
- Search/status filters retained.
- Date-range filtering added, anchored to the newest observed timestamp in the loaded dataset rather than `Date.now()`.
- Sort by time / latency / observed cost.
- Optional 10-second auto refresh.
- Page size and client-side paging for the loaded dataset.
- CSV export for visible rows only.
- Request detail drawer added.
- Token/cost values stay nullable and source-truthful.

## Traces
- Status and provider filters added.
- Streaming rendered as source-aware badges.
- Trace timeline shows only observed edge start/completion timing.
- Intermediate OmniRoute/provider attempt timestamps are explicitly omitted when not observed.
- Provider/model evidence remains nullable.
- Copy states that OmniRoute owns provider selection and fallback.

## Metrics
- Request-volume chart retained/refined with honest labels.
- Local runtime heap/RSS visual comparison added.
- Runtime detail modal added.
- Provider attribution/cost bars use observed values only.
- CPU trend is explicitly omitted because current runtime contract exposes cumulative CPU time, not a utilization time series.

## Analytics
- Real `hours` time-window selector added.
- Traffic / Providers / Usage / Reliability / Regions tabs added.
- Traffic chart can expand into a modal.
- Provider attribution, token/cost, status, and security severity views use observed data.
- Regions tab explicitly states geographic telemetry is unavailable until Cloudflare edge evidence exists.

## Alerts
- Active / History / Rules tabs added.
- Severity and source filters added.
- Alert detail drawer added.
- Active alerts are described as derived from observed gateway request outcomes.
- Durable acknowledgement/history is not fabricated when persistence is absent.

## Audit Log
- Search plus Action and Resource filters added.
- Audit detail drawer added.
- Before/After JSON is shown only when present in the source detail.
- Missing historical snapshots render `Not recorded` rather than synthetic state.
- Missing timestamps remain unknown.

## Topology
- Added configured provider / observed traffic / authoritative health / filter-result KPI strip.
- Provider-state filter and result count added.
- Full provider list is available in the workspace.
- Provider status dots reflect only permitted source semantics.
- Provider detail inspector added.
- Workspace remains read-only and contains no local routing actions.

## Settings
- General / Data / OmniRoute / Cloudflare / Advanced tabs added.
- Runtime warning banner added for missing/unreachable/unavailable runtime states.
- Data tab exposes source cards.
- OmniRoute tab has an explicit refresh/ping of the existing status call and capability matrix.
- Cloudflare tab refuses to invent Worker version, D1 ID, Tunnel identity, custom domain, colo, or Analytics binding when not exposed by current contracts.
- Advanced tab exposes local runtime metrics and bootstrap information.

## Audit-report corrections incorporated

The supplied HTML audit was treated as a backlog input rather than an authority. Confirmed gaps were implemented where supported by real data. Incorrect claims were not reproduced, including:
- API key revoke previously used native `confirm()`, not `alert()`.
- Topology already had a filter-result signal.
- Security-policy capability data was dynamic rather than purely static.
- Models already exposed an OmniRoute model-surface count.
- Several requested trend/gauge concepts cannot be truthfully populated from current data contracts and therefore remain unavailable instead of being faked.
- Audit Log was missing from the HTML audit even though it is a real application route; it has been refined in this pass.

## Verification evidence in the working tree

- `npm run test:node`: PASS — 54/54.
- `npm run verify:data`: PASS — 26 providers, 433 models, 6 API-key metadata records, 24/26 provider credentials configured, 2 observed requests, 1 security event, both databases integrity/FK/schema PASS.
- `ALLOW_LOCAL_DATA_BUNDLE=1 npm run verify:safety`: PASS.
- TS/TSX parser/transpile syntax check: PASS — 58 files.
- `npm ci --offline`: BLOCKED because `zod-3.25.76.tgz` is not present in the local npm cache.
- Dependency-backed `npm run lint`, `npm test`, and `npm run build`: NOT VERIFIED in this sandbox because a complete dependency install is unavailable. A prior partial network install was discarded and is not packaged.

## Windows verification entry point

Run `VERIFY-AND-BUILD.cmd` after extraction on the target Windows machine. It performs dependency restore and the dependency-backed verification/build path without changing the architectural authority model.
