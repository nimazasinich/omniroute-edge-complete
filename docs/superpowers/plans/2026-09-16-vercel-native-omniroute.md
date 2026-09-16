# Vercel-native OmniRoute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing OmniRoute Edge app plus pinned OmniRoute 3.8.50 on the connected Vercel project with Turso-backed control-plane state and no Render runtime dependency.

**Architecture:** Vercel runs the existing Node server inside `Dockerfile.vercel`. The Node server starts OmniRoute on loopback ports and reuses `gatewayCore` for `/v1`; Turso backs only the application-owned DB.

**Tech Stack:** Node 24, Vite, Hono, libSQL/Turso, OmniRoute 3.8.50, Vercel Fluid Compute/container runtime.

**Spec:** `docs/superpowers/specs/2026-09-16-vercel-native-omniroute-design.md`

## Global Constraints
- OmniRoute alone owns provider/model/routing/retry/fallback.
- Never print or commit secrets.
- Missing runtime secrets fail closed.
- `BLOCKED`, `SKIP`, and `UNVERIFIED` are never PASS.
- `main` remains unchanged until branch verification is acceptable.

---

### Task 1: Add failing Vercel/Turso contracts

**Files:**
- Create: `test-node/vercel-native-runtime.test.mjs`
- Modify: `.github/workflows/verify.yml`

**Interfaces:**
- Consumes current `server.ts`, `src/server/db/node.ts`, and runtime files.
- Produces executable source contracts for Vercel container, Turso config, embedded runtime, and Node `/v1` wiring.

- [ ] Add contract assertions for `Dockerfile.vercel`, `vercel.json`, Turso env use, `omniroute@3.8.50`, loopback API origin, and `handleGatewayRequest` in `server.ts`.
- [ ] Enable branch CI for `vercel-native-runtime`.
- [ ] Push and confirm the new contract fails for the expected missing implementation.

### Task 2: Add Vercel container contract

**Files:**
- Create: `Dockerfile.vercel`
- Create: `vercel.json`

**Interfaces:**
- Produces a Node 24 image with app build output and pinned global OmniRoute executable.

- [ ] Build app with `npm ci`, `npm run build`, and esbuild for `server.ts`.
- [ ] Install `omniroute@3.8.50` in runtime image.
- [ ] Run as non-root and keep OmniRoute data under writable `/tmp/omniroute`.
- [ ] Enable Vercel Fluid Compute.

### Task 3: Add Turso-backed Node DB selection

**Files:**
- Modify: `src/server/db/node.ts`

**Interfaces:**
- Consumes `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and existing `SQLITE_DB_PATH`.
- Produces the existing `AppDb` shape without changing application handlers.

- [ ] Use remote libSQL when `TURSO_DATABASE_URL` is configured.
- [ ] Require `TURSO_AUTH_TOKEN` for a remote URL.
- [ ] Preserve local SQLite fallback when Turso is absent.

### Task 4: Bootstrap embedded OmniRoute and wire Node `/v1`

**Files:**
- Create: `runtime/embedded-omniroute.mjs`
- Modify: `server.ts`

**Interfaces:**
- `startEmbeddedOmniRoute()` returns `{ origin, apiKey, child }` for the loopback API bridge.
- `server.ts` passes that origin to the existing `handleGatewayRequest`.

- [ ] Spawn pinned OmniRoute executable on dashboard port 20129/API port 20130 with public `PORT` removed from child env and extended readiness budget.
- [ ] Fail closed if embedded mode lacks `STORAGE_ENCRYPTION_KEY` or `OMNIROUTE_API_KEY`.
- [ ] Authenticate `/v1` using env gateway token and existing DB API keys.
- [ ] Provide a bounded Node rate limiter and preserve streaming/telemetry semantics without adding routing logic.
- [ ] Forward non-`/v1` traffic to the existing Hono app/static frontend.

### Task 5: Verify branch and Vercel Preview

**Files:** none unless a real failure requires the smallest correction.

- [ ] Confirm GitHub CI status for branch HEAD.
- [ ] Inspect Vercel deployment/check status attached to the commit.
- [ ] If deploy is live, probe `/signin` and `/api/health`; inspect runtime errors.
- [ ] Test authenticated `/v1/models` only when required Vercel secrets are configured; otherwise report exact BLOCKED state.
- [ ] Do not merge/promote to `main` until evidence is acceptable.
