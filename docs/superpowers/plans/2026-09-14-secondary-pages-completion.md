# OmniRoute Edge Secondary Pages Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete every secondary OmniRoute Edge UI route with truthful real-data surfaces while preserving the current dashboard/login/loading work and read-only OmniRoute authority boundary.

**Architecture:** Keep the existing React/Vite/Hono structure, add one small shared page-primitives module, create a dedicated `MetricsView`, and upgrade the existing secondary views in place. All operational values come from the existing `DashboardData`/API contracts; unavailable measurements render as unknown rather than synthetic values.

**Tech Stack:** React 19, React Router, TypeScript, Tailwind CSS v4 utility classes, lucide-react, Hono, Vitest/Node contract tests.

**Spec:** `docs/superpowers/specs/2026-09-14-secondary-pages-completion-design.md`

## Global Constraints
- Canonical PC destination remains `C:\project\OmniRoute_SecureAIRouter_\OmniRoute-Edge-COMPLETE-PROJECT-WITH-DEPLOYER\OmniRoute-Edge-Complete-Project`.
- OmniRoute is the only routing authority; UI/control surfaces must not implement local routing/failover.
- No fabricated health, latency, cost, geo, security, trend, traffic, or incident values.
- Preserve the two verified database files and their provider/model inventory.
- Do not expose secrets or weaken existing auth behavior.
- Do not delete/weaken tests merely to make verification green.

---

### Task 1: Contract tests for completed secondary routes
**Files:**
- Modify: `test-node/v32-ui-completion.test.mjs`
- Create: `test-node/secondary-pages-completion.test.mjs`

- [ ] Add tests requiring a dedicated `MetricsView`, purpose-built route wiring, page markers for logs/traces/audit/alerts/keys/analytics, and no known fake screenshot metrics.
- [ ] Run the new test and verify it fails because `/metrics` is still an Analytics alias and required markers/components are absent.

### Task 2: Shared secondary-page primitives
**Files:**
- Create: `src/components/PagePrimitives.tsx`

- [ ] Add small reusable header, metric tile, source badge, empty-state, and filter-shell components.
- [ ] Keep primitives presentational only; no data fabrication or hidden fallback logic.

### Task 3: Dedicated Metrics page and route
**Files:**
- Create: `src/components/MetricsView.tsx`
- Modify: `src/App.tsx`

- [ ] Render observed request volume, latency, token totals, local Node runtime metrics, and provider aggregates only when available.
- [ ] Label runtime source explicitly and show unknown/unavailable states honestly.
- [ ] Route `/metrics` to `MetricsView` instead of `AnalyticsView`.

### Task 4: Complete inventory/control surfaces
**Files:**
- Modify: `src/components/ProvidersView.tsx`
- Modify: `src/components/ModelsView.tsx`
- Modify: `src/components/RoutingRulesView.tsx`
- Modify: `src/components/SecurityPoliciesView.tsx`
- Modify: `src/components/FirewallView.tsx`
- Modify: `src/components/SettingsView.tsx`

- [ ] Normalize page hierarchy, filters, source/provenance labels, degraded/empty states, and read-only capability language.
- [ ] Ensure provider snapshot health is never presented as authoritative live health.
- [ ] Ensure routing/policy/firewall pages never claim unsupported management capabilities.

### Task 5: Complete observability surfaces
**Files:**
- Modify: `src/components/LogsView.tsx`
- Modify: `src/components/TracesView.tsx`
- Modify: `src/components/AnalyticsView.tsx`
- Modify: `src/components/AlertsView.tsx`
- Modify: `src/components/AuditLogView.tsx`
- Modify: `src/components/ApiKeysView.tsx`

- [ ] Preserve existing API-backed behavior while improving hierarchy, filtering, source labels, and explicit unavailable states.
- [ ] API keys continue one-time secret reveal only; never render stored secret material.

### Task 6: Navigation and styling consistency
**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/index.css` only if shared page styles are necessary.

- [ ] Add Audit Log navigation if not already reachable from sidebar.
- [ ] Keep all existing routes and visual language consistent with the approved dashboard.

### Task 7: Verification and package
**Files:**
- Create: `SECONDARY-PAGES-VERIFICATION.md`

- [ ] Run focused Node tests.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run test:node`.
- [ ] Run `npm run build`.
- [ ] Run `npm run verify:data`.
- [ ] Record exact pass/fail/blocker evidence; never convert blocked/unverified into PASS.
- [ ] Package the complete sanitized project without `node_modules`/stale build artifacts or secrets.
