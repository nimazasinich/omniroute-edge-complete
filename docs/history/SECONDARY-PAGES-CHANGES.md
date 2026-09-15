# Secondary Pages Changes

Key implementation files:

- `src/components/PagePrimitives.tsx` — shared truthful page UI primitives.
- `src/components/MetricsView.tsx` — dedicated observed-metrics surface.
- `src/App.tsx` — `/metrics` now routes to `MetricsView`.
- `src/components/ProvidersView.tsx`
- `src/components/ModelsView.tsx`
- `src/components/RoutingRulesView.tsx`
- `src/components/SecurityPoliciesView.tsx`
- `src/components/FirewallView.tsx`
- `src/components/LogsView.tsx`
- `src/components/TracesView.tsx`
- `src/components/AnalyticsView.tsx`
- `src/components/AlertsView.tsx`
- `src/components/AuditLogView.tsx`
- `src/components/ApiKeysView.tsx`
- `src/components/SettingsView.tsx`
- `src/components/Sidebar.tsx`
- `test-node/secondary-pages-completion.test.mjs`
- `test-node/pc-package-safety.test.mjs`
- `scripts/verify-v3-static.mjs`
- `VERIFY-AND-BUILD.cmd`

Operational rule: unavailable data is displayed as unknown/unavailable/no-observed-data. No fake operational values were introduced.
