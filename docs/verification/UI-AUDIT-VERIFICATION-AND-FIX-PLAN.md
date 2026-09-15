# UI Audit Verification & Fix Plan (for the next coding agent)

Source reviewed: `omniroute_ui_audit_report.html` (14-page completeness audit,
scores 42-100) cross-checked against the live source in this repo on
2026-09-14.

## 0. IMPORTANT — the audit is not fully reliable

Several specific claims in the audit do NOT match the current source. Do not
implement any audit gap without first opening the real file and confirming
it still exists — several "missing" features are already built.

### Confirmed FALSE / stale claims (do not act on these as written)

- **Analytics (`AnalyticsView.tsx`)**
  - Claim "Security-by-severity data present in types but not rendered
    here" — FALSE. A "Security by Severity" section with colored bars is
    already rendered (bottom row, 3rd column).
  - Claim "Request status breakdown uses pill chips instead of visual
    bars" — FALSE. It already renders horizontal progress bars per status.
  - Claim "Metric tiles have no sparklines" — FALSE. The "Observed
    requests" `MetricTile` already passes `sparklinePoints`.
  - Claim "Entire file is single-line minified JSX — unmaintainable" —
    FALSE. The file is normally formatted, multi-line, ~310 lines.
  - Real, still-open gaps: no time-range selector (window is API-driven
    only), token usage is plain numbers (no chart), no cost-trend chart.

- **Metrics (`MetricsView.tsx`)**
  - Claim "CPU / memory metrics are tiles only — no gauge or progress
    ring visualization" — FALSE. It already renders `GaugeRing` (from
    `PagePrimitives.tsx`) for heap % and RSS.

- **Providers (`ProvidersView.tsx`)**
  - Claim "Health status shown as text badge only, no visual gauge" —
    PARTIALLY FALSE. `StatusDot` is already used next to the status
    badge (enabled/disabled row and health row). There is no gauge, but
    it is not "text only" either.
  - Still open: no traffic-share bar visualization, no latency
    sparklines, no card-grid alternative view.

- **Firewall (`FirewallView.tsx`)**
  - Claim "Entire component is one-line compressed JSX" — FALSE (spot
    checked lines 1-15 and ~200-220: normally formatted, multi-line).
    Re-verify the rest of the file before repeating this claim anywhere.

### Coverage gap in the audit itself

`App.tsx` actually registers **15** routes, not 14:
`/, /topology, /providers, /models, /routing, /keys, /policies,
/firewall, /logs, /analytics, /alerts, /metrics, /traces, /audit,
/settings`.

The audit completely omits **`/audit` → `AuditLogView.tsx`**. This page
was not scored or reviewed at all. Include it in this fix pass.

## 1. CONFIRMED gaps (verified against current source — safe to act on)

### `/keys` ApiKeysView.tsx (audit score 88)
- No "last used" timestamp column, no per-key usage stats, no
  rotation/expiry reminder.
- Revoke uses native `confirm()` dialog — replace with an inline
  confirm modal matching the rest of the app's modal style (see the
  "Create key" / "Reveal secret" modals already in this file for the
  visual pattern to reuse).

### `/logs` LogsView.tsx (audit score 85)
- No pagination past `limit=100` (no "load more").
- No date-range filter (only status + free-text search).
- No column sorting, no row-expand/detail drawer for the `error` field.
- No auto-refresh toggle (manual "Refresh" button only).
- No CSV export.
- The 4 top stat tiles are plain `div`s with no icon — reuse
  `MetricTile` from `PagePrimitives.tsx` (it already supports an
  `icon`/`iconColor` prop) instead of the bespoke markup currently used.

### `/traces` TracesView.tsx (audit score 78)
- No status-code filter or provider filter (search box only).
- Detail panel has no waterfall/timeline visualization.
- `streaming` is rendered as literal "Yes"/"No" text — use a colored
  badge (pattern already exists elsewhere, e.g. Active/Revoked badges
  in ApiKeysView.tsx).
- List rows have no color-coded status dot — reuse `StatusDot` from
  `PagePrimitives.tsx` (already used in ProvidersView.tsx).
- The 4 top stat tiles lack icons — same `MetricTile` fix as Logs.

### `/analytics` AnalyticsView.tsx (audit score 70 — several claims false, see §0)
Real remaining gaps only:
- No time-range selector; window comes from the API response only.
- Token usage (`tokensIn`/`tokensOut`) rendered as plain numbers — no
  chart.
- No cost-trend visualization (single current-value tile only).

### `/metrics` MetricsView.tsx (audit score 68 — gauge claim false, see §0)
Real remaining gaps only:
- No uptime visualization beyond the `Xh Ym` text string.
- Bar chart has only a native `title` tooltip, no hover card, no axis
  labels.
- No RSS-vs-heap comparison chart, no CPU trend over time.
- Provider attribution cards have no cost-trend sparkline (reuse
  `MetricTile`'s `sparklinePoints` prop, already used in
  AnalyticsView.tsx, for consistency).

### `/policies` SecurityPoliciesView.tsx (audit score 45)
- No posture score/gauge beyond the raw `2/5` count — consider
  `GaugeRing` from `PagePrimitives.tsx` (already used in
  MetricsView.tsx) instead of plain text.
- Security-events block only shows 3 bare fields per row, not a proper
  table.
- Readiness-issues list has no severity coloring.
- No link from here to `/firewall` for event drill-down.
- File is written as near-single-line JSX per section — reformat for
  maintainability while touching it (this one claim IS accurate).

### `/models` ModelsView.tsx (audit score 42)
- Table-only, no card grid or per-model detail panel.
- Capability tags rendered as a comma-joined string — use colored
  chips instead (pattern: the model-ID pill chips already in this same
  file, "Live OmniRoute model IDs" section).
- Context window shown as a raw number, no scale/bar.
- Prompt/completion cost shown as raw `String(value)`, not formatted
  as currency-per-1k.
- "Enabled snapshot" column is literal "Yes"/"No" text — use a badge.

### `/providers` ProvidersView.tsx (audit score 60 — StatusDot claim partly false, see §0)
Real remaining gaps only:
- No card-grid alternative to the table.
- Traffic-share column is text-only (`X%`) — use `MiniBar` from
  `PagePrimitives.tsx` (built but currently unused anywhere in the
  codebase — good first place to use it).
- No provider latency sparklines.
- Bottom info-row is 3 static tip cards, not live data.

### `/firewall` FirewallView.tsx (audit score 55 — "one-line JSX" claim false, see §0)
Re-verify against current file before fixing, but these look plausible
and were not contradicted by the sections read:
- No chart of events over time (flat table only).
- No top-event-types or top-attacker-IP breakdown.
- Severity distribution is not visualized anywhere on the page.
- The "Prompt firewall: Not integrated" tile is not actionable copy.

## 2. NOT INDEPENDENTLY VERIFIED — re-read the file before touching

These pages were NOT opened in this pass. Given that several claims
elsewhere in the audit turned out to be stale or wrong, treat every
claim below as a hypothesis to confirm, not a fact:

- `/routing` RoutingRulesView.tsx ("Routing Status", score 62)
- `/topology` TopologyView.tsx (score 72)
- `/alerts` AlertsView.tsx (score 75)
- `/settings` SettingsView.tsx (score 52)
- `/audit` AuditLogView.tsx — not in the audit at all (see §0). It
  currently has: search, refresh, admin-token status indicator, but no
  stat tiles, no filters by action/resource type, and no pagination
  past `limit=250`. Apply the same completeness pass used for Logs.

## 3. Working rules for whoever implements this

1. **Verify before you fix.** For every gap you're about to address,
   open the current file first. Do not trust the audit's line/behavior
   claims — multiple were already wrong at the time of this review
   (§0). This codebase is being actively edited; files may have moved
   on again since this plan was written.
2. **Reuse `PagePrimitives.tsx` before building anything new.** It
   already contains `MetricTile` (icon, sparkline, trend, progress bar
   all built in), `GaugeRing`, `MiniBar`, `StatusDot`, `SourceBadge`,
   `EmptyState`, `DataNotice`, `PageHeader`. Several of these
   (`MiniBar` especially) are defined but unused anywhere — prefer
   using them over inventing new one-off visual components per page.
3. **Do not fabricate data.** This codebase has an explicit,
   repeated convention (see `../history/SECONDARY-PAGES-CHANGES.md`): "unavailable
   data is displayed as unknown/unavailable/no-observed-data. No fake
   operational values." Any new chart/sparkline/gauge must degrade
   gracefully to an empty/unknown state when the API has no data —
   follow the existing `EmptyState`/`DataNotice` patterns, don't
   invent placeholder numbers.
4. **Match the Dashboard's visual language**, not just its feature
   list: icon-badged `MetricTile`s, colored trend text, sparklines
   where a time series exists, and modular sub-components (see
   `DashboardView.tsx` + `KpiCard.tsx`, `RuntimeResourcesCard.tsx`,
   `ProviderHealthCard.tsx` for the reference style).
5. **Format any file you touch.** A few pages (confirmed:
   `SecurityPoliciesView.tsx`) use near-single-line JSX per section.
   If you're editing a file for a gap fix, reformat the section you
   touch to normal multi-line JSX in the same pass.
6. Cover `/audit` (`AuditLogView.tsx`) in this work even though the
   audit report skipped it — see §0 and §2.
