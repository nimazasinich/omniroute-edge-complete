# Dashboard Real Data Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the supplied UI revisions into the complete OmniRoute project and reconnect dashboard data paths so every displayed value comes from existing D1, Worker, or OmniRoute contracts without fabricated operational data.

**Architecture:** Keep OmniRoute as sole routing authority. Preserve the existing Cloudflare Worker + D1 control plane and browser-session auth. Improve the UI data bridge by consuming the richer existing read endpoints, record authenticated edge failures that currently disappear before origin forwarding, and surface real control-plane inventory when Worker runtime memory is unavailable.

**Tech Stack:** React 19, TypeScript, Hono, Cloudflare Workers/D1, Drizzle ORM, Node test runner, Vitest.

**Spec:** User request in current conversation plus the supplied updated UI ZIP and standalone `KpiCard.tsx`, `TopologyMap.tsx`, and `index.css`.

## Global Constraints

- OmniRoute remains the sole routing/provider/model/retry/fallback authority.
- No VPC or Cloudflare Tunnel.
- No fabricated provider health, routing decisions, latency, traffic, or runtime metrics.
- Missing external OmniRoute origin stays explicitly NOT CONFIGURED / BLOCKED.
- Browser auth remains D1 session based; `/v1/*` gateway auth remains separate.
- Do not package `.env`, runtime DB files, `.wrangler`, `node_modules`, or secrets.

---

### Task 1: Merge supplied UI revisions safely

**Files:**
- Modify: `src/components/DreamWorkerAuthScreen.tsx`
- Modify: `src/components/DreamWorkerLoadingScreen.tsx`
- Modify: `src/components/KpiCard.tsx`
- Modify: `src/components/TopologyMap.tsx`
- Modify: `src/index.css`

- [ ] Copy only UI source files from the supplied UI-only package; preserve the complete project's backend `package.json`/lockfile and deployment configuration.
- [ ] Overlay the three separately supplied files as the newest source of truth.
- [ ] Run source-level contract checks for imports and prohibited fake operational values.

### Task 2: Reconnect real dashboard read paths

**Files:**
- Test: `test-node/dashboard-real-data-bridge.test.mjs`
- Modify: `src/App.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/RuntimeResourcesCard.tsx`

- [ ] Write a failing contract test requiring `/api/providers/health`, rich `/api/analytics?hours=24`, real model inventory KPI, and explicit Not configured origin state.
- [ ] Verify RED.
- [ ] Update dashboard fetch orchestration to merge rich legacy analytics with v2 metrics and use the provider-health read model with v2 catalog fallback.
- [ ] Replace the unusable Worker runtime-memory KPI with real model inventory.
- [ ] When Node runtime metrics are unavailable, render real D1/control-plane counts instead of empty memory/CPU placeholders.
- [ ] Verify GREEN.

### Task 3: Preserve live topology health without leaking stale snapshot health

**Files:**
- Test: `test-node/topology-live-health-bridge.test.mjs`
- Modify: `src/server/app.ts`

- [ ] Write a failing static contract test requiring live origin health to be forwarded into topology while snapshot fallback remains unknown unless disabled.
- [ ] Verify RED.
- [ ] Track whether provider data came from OmniRoute or D1 and map `healthStatus/status` only for authoritative live origin data.
- [ ] Verify GREEN.

### Task 4: Record authenticated pre-origin gateway failures in D1 telemetry

**Files:**
- Test: `test-node/gateway-core.test.mjs`
- Test: `test-node/d1-telemetry.test.mjs`
- Modify: `src/edge/gatewayCore.ts`
- Modify: `src/edge/d1Telemetry.ts`

- [ ] Add failing tests for authenticated `origin_not_ready` and `rate_limit_not_ready` telemetry.
- [ ] Verify RED.
- [ ] Record these real edge outcomes with request/correlation IDs and truthful edge routing reasons.
- [ ] Verify GREEN.

### Task 5: Full verification and sanitized package

**Files:**
- Create: `README-PACKAGE.md`
- Create: `PACKAGE-MANIFEST.sha256`

- [ ] Run all dependency-free Node contract tests possible in this environment.
- [ ] Run TypeScript/build if dependencies are available; otherwise record the exact blocker and never call it PASS.
- [ ] Scan package for secret/runtime artifacts.
- [ ] Create a complete ZIP containing source, backend, migrations, tests, configs, docs, and supplied UI revisions.
- [ ] Verify ZIP extraction and manifest hashes.
