# CP09 Complete Deep UI Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the safe CP08 auth and normalized v2 backend capabilities into the verified Deep UI v2 baseline without regressing its richer UI or OmniRoute authority boundaries.

**Architecture:** Keep Deep UI v2 as the source/UI baseline. Add real admin session validation and backend-driven connecting flow, then add only the CP08 v2 service/adapter/read-model stack that does not depend on retired local routing/firewall/policy/health modules.

**Tech Stack:** React 19, React Router 7, TypeScript 5.8, Hono, Drizzle ORM, Cloudflare Workers/D1, Node test runner, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-cp09-complete-deep-ui-merge-design.md`

## Global Constraints
- Canonical viewport: 1368x753.
- OmniRoute remains the only routing/provider/model/retry/fallback authority.
- Never fabricate operational values.
- No raw secrets in the package.
- Retired CP08 local authority modules must not be restored.

---

### Task 1: Auth and protected-route merge
**Files:** `src/auth/adminAuth.ts`, `src/components/DreamWorkerAuthScreen.tsx`, `src/components/DreamWorkerLoadingScreen.tsx`, `src/App.tsx`, `src/components/Header.tsx`, `test-node/v35-dreamworker-auth-flow.test.mjs`
- [ ] Add failing auth-flow contract test.
- [ ] Verify RED on the timer/decorative baseline.
- [ ] Implement admin-token validation, stored-session revalidation, backend-driven connecting checks, protected routes, and sign-out.
- [ ] Run auth and Deep UI contracts.

### Task 2: Safe `/api/v2` backend merge
**Files:** `src/api/v2/*`, `src/domain/platform.ts`, `src/services/*`, `src/integrations/*`, `src/repositories/*`, `src/server/app.ts`, `src/server/db/schema.ts`, `src/server/db/node.ts`, `drizzle/0004_routing_decision_index.sql`
- [ ] Add failing CP09 v2 integration contract test.
- [ ] Verify RED because v2 modules are absent.
- [ ] Copy only safe CP08 v2 modules and register them in Hono.
- [ ] Add observation-only routing decision read-model storage.
- [ ] Verify no retired local routing/firewall/policy/health modules exist.

### Task 3: Verification and integrated ZIP
**Files:** project-wide plus `CP09-COMPLETE-DEEP-UI-MERGE-REPORT.md`
- [ ] Run full node suite and static safety verifier.
- [ ] Run data verifier without printing secrets.
- [ ] Attempt dependency-backed typecheck/Vitest/build and report genuine blockers.
- [ ] Scan output package for `.env`, node_modules, secret-looking artifacts, and retired local modules.
- [ ] Create one integrated CP09 ZIP and CRC/integrity-check it.
