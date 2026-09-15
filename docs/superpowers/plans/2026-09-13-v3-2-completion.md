# OmniRoute Edge V3.2 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete UI, operational data contracts, and deployment verification without fabricated operational data.

**Architecture:** Worker remains the sole production gateway; OmniRoute remains routing authority; D1 mirrors edge-observed facts; UI consumes explicit capability/source metadata and remains read-only where authoritative management is absent.

**Tech Stack:** React 19, TypeScript, Hono, Drizzle, Cloudflare Workers/D1/Rate Limiting, Vite, Vitest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-v3-2-completion-design.md`

## Global Constraints
- No fabricated provider/model/health/traffic/cost/token/routing data.
- Unknown values render as unknown/null, not zero unless zero is directly observed.
- OmniRoute is the only routing/fallback authority.
- No local provider mutation until a real OmniRoute management API exists.
- Production `/v1/*` stays in `src/worker.ts` only.
- No secrets, `.env`, DB snapshots or `node_modules` in replacement package.

---

### Task 1: Truth-source capability APIs
**Files:** `src/types.ts`, `src/server/app.ts`, `src/worker.ts`, `src/App.tsx`, `test-node/v32-capabilities.test.mjs`
- [x] RED: tests require `/api/system/capabilities`, `/api/omniroute/status`, origin bindings and UI consumption.
- [x] GREEN: implement explicit capability and OmniRoute `/v1/models` connectivity status with fail-closed timeout/error reporting.
- [x] Verify node tests.

### Task 2: Honest request telemetry enrichment
**Files:** `src/edge/gatewayCore.ts`, `src/edge/d1Telemetry.ts`, `src/server/db/schema.ts`, `drizzle/0003_observed_metrics.sql`, `src/server/app.ts`, `test-node/v32-telemetry-truth.test.mjs`
- [x] RED: tests require requested-model extraction and nullable observed token/cost metrics.
- [x] GREEN: parse real requested model from a bounded cloned JSON request; keep selected model/provider/token/cost unknown without authority.
- [x] Verify node tests.

### Task 3: Complete provider/model/routing/security UI
**Files:** Providers/Models/RoutingRules/SecurityPolicies/Firewall components plus CSS and tests.
- [x] RED: require search/filter/source/capability/empty-state markers and forbid mutation/fake-state language.
- [x] GREEN: implement operationally complete read-only workspaces.
- [x] Verify node tests.

### Task 4: Complete settings/dashboard status integration
**Files:** `DashboardView.tsx`, `RuntimeResourcesCard.tsx`, `SettingsView.tsx`, `Header.tsx`, `src/types.ts`, CSS, tests.
- [x] RED: require OmniRoute connectivity, explicit unavailable runtime state, capability/source labels.
- [x] GREEN: surface only real connectivity and observed telemetry.
- [x] Verify node tests.

### Task 5: Full verification and replacement artifact
**Files:** package metadata, docs, verification logs, manifest, final ZIP.
- [x] Run dependency-free suite and static safety.
- [x] Parse all TS/TSX syntax.
- [x] Attempt dependency restore and record real status: online restore timed out; offline restore is BLOCKED by missing cached `yocto-queue-1.2.2.tgz`; dependency-backed lint/Vitest/build remain BLOCKED, not PASS.
- [ ] Generate manifest after final verification pass.
- [ ] Build ZIP, fresh-extract, hash-compare, secret scan after manifest.
