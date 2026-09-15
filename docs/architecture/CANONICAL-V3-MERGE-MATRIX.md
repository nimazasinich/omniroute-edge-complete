# Canonical V3 Merge Matrix — OmniRoute Edge

**Prepared from:** `bun.zip` / `bun(1).zip`, `.env.zip`, and `OmniRoute_SecureAIRouter_Unified_Plan(2).md`  
**Purpose:** produce one canonical, secure, reproducible V3 without silently preserving conflicting runtime behavior.

---

## 0. Canonical decision

Treat the existing artifacts as follows:

- **`bun.zip` / `bun(1).zip`** = clean historical/verification baseline. They are content-identical.
- **`.env.zip`** = newer working branch / donor for selected improvements.
- **Canonical V3** = a new reconciled source tree. Neither ZIP is accepted unchanged as final source of truth.

Recommended implementation rule:

> Start from the newer `_env` source tree for development, but reconcile every changed file against `bun`, remove unsafe/runtime artifacts, and do not call V3 canonical until the full verification matrix passes on the exact same source/artifact.

`node_modules` is intentionally excluded and is **not** a defect. Reproducibility must be proven with the chosen lockfile.

---

# 1. V3 target architecture

```text
Client
  |
  v
Cloudflare Worker: omniroute-edge
  - gateway authentication
  - per-key rate limiting
  - request/correlation IDs
  - thin request/security telemetry
  - transparent streaming passthrough
  |
  v
Cloudflare Tunnel / HTTPS origin
  |
  v
OmniRoute
  - provider selection
  - model routing
  - retry/fallback
  - provider health/quota
  - routing truth
```

Dashboard:

```text
Authoritative edge / OmniRoute telemetry
                 |
                 v
                D1
                 |
                 v
          React Dashboard
```

### Hard architecture rules

1. **OmniRoute is the only routing authority.**
2. Worker must not implement provider/model scoring, retry, or fallback.
3. D1 must not become a second routing configuration database.
4. Dashboard may mutate provider/model/routing state only if the action changes real OmniRoute state through an explicit management API.
5. Unknown runtime facts remain unknown; never synthesize provider, health, latency, cost, availability, or routing evidence.
6. Production `/v1/*` has one authoritative implementation path: the Worker.
7. Node/Hono local server is dev/test only unless explicitly brought to behavioral parity with Worker.

---

# 2. Root / packaging merge matrix

| Path | V3 decision | Reason / acceptance |
|---|---|---|
| `.env` | **DELETE / NEVER PACKAGE** | Runtime secrets must not ship with source or release artifact. |
| `.env.example` | **REWRITE** | Keep variable names/documentation only; no real values. Include only variables actually used by V3. |
| `.gitignore` | **KEEP + HARDEN** | Exclude `.env*`, `*.db`, runtime dumps, provider/key exports, scratch secret artifacts, `node_modules`, generated build output as appropriate. |
| `package.json` | **REWORK** | Normalize dependencies after dead routing/control-plane code is retired. Avoid unpinned `npx` runtime dependencies. |
| `package-lock.json` | **USE AS PACKAGE-MANAGER BASE** | npm is the least-risk current choice because the cleaner baseline carries the npm lockfile and prior scripts/evidence are npm-oriented. Regenerate once V3 `package.json` is final, then prove `npm ci`. |
| `bun.lock` | **DELETE FROM V3** | Avoid multiple package-manager truths. Bun can be evaluated later as an explicit migration. |
| `pnpm-lock.yaml` | **DELETE** | Same reason. |
| `pnpm-workspace.yaml` | **DELETE** | No justified monorepo/workspace architecture currently requires it. |
| `node_modules/` | **KEEP ABSENT** | Correct source/release hygiene. Acceptance = clean dependency restore from lockfile. |
| `dist/` | **REBUILD; NOT SOURCE OF TRUTH** | Build output must come from exact canonical source. |
| `PACKAGE-MANIFEST.json` | **REGENERATE AUTOMATICALLY** | Existing manifest can drift from source. Manifest must hash the exact final artifact. |
| `DEPLOY-OMNIROUTE-EDGE-ONECLICK.bat` | **REPLACE / REDESIGN** | Current file embeds a ZIP payload, allowing inspected source and deployed source to diverge. New deployer must consume the exact verified artifact and expected hash. |
| `sqlite.db` | **DELETE / NEVER PACKAGE** | Runtime state, not source. |
| `data/providers-and-keys.json` | **DELETE / NEVER PACKAGE** | Contains credential/provider state that should not exist in a source release. |
| `scratch_omniroute_raw.json` | **DELETE / NEVER PACKAGE** | Raw runtime/provider dump. |
| `audit_db.py` | **QUARANTINE OR DELETE** | Keep only if rewritten/documented as a secret-safe developer tool. |
| `scratch/` | **EXCLUDE FROM PRODUCTION ARTIFACT** | Development-only files require explicit justification to survive. |
| `scripts/migrate-omniroute.mjs` | **DO NOT MERGE AS-IS** | Current implementation has an unsafe fallback secret, exports decrypted/raw credential material, creates local secret-bearing artifacts, and synthesizes health/latency-like data. Rewrite from zero only if a real migration is required. |
| historical root reports (`*.md`) | **MOVE TO `docs/history/`** | Useful evidence, but not current source of truth. |
| `checkpoints/` | **PRESERVE AS HISTORY** | Keep under `docs/checkpoints/` or external archive. Never allow checkpoint code to shadow canonical runtime source. |
| log/evidence directories | **ARCHIVE ONLY** | V3 must generate fresh evidence against the exact V3 artifact. |
| `cloudflare-ai-router-1368x753.html` | **REFERENCE ONLY** | Move to `docs/reference/` if still needed for UI comparison. |

---

# 3. Runtime/backend merge matrix

## `src/worker.ts`

**Decision: KEEP CONCEPT, MAJOR REWORK**

Current good behavior:

- `/v1/*` bypasses the old local provider router.
- validates public gateway auth.
- fails closed if auth is not configured.
- strips public `Authorization` before forwarding.
- validates OmniRoute origin.
- creates request/correlation IDs.
- returns the upstream stream directly.
- performs no edge retry/fallback.

Required V3 changes:

- add per-key rate limiting.
- add real D1 telemetry for `/v1/*`.
- return structured, honest failure on origin/network errors.
- preserve real streaming without buffering.
- ensure telemetry writes do not block/replace the upstream stream.
- identify the authenticated key/tenant in telemetry without storing raw keys.
- normalize one gateway-auth source model.
- add Worker-path tests; do not rely on Hono Node tests for production behavior.

**Do not add:** provider scoring, provider health probing, model selection, retry, fallback.

---

## `src/server/app.ts`

**Decision: REDUCE TO ADMIN / OBSERVABILITY API**

The `_env` version correctly removes the old local `routeRequest()` call from its Node `/v1/chat/completions` handler, but V3 still has a structural problem:

- production Worker intercepts `/v1/*` before `app.ts`;
- Node/Hono implements a second `/v1/chat/completions`;
- the Node path performs firewall checks and D1 lifecycle logging that the Worker path does not.

This creates **behavioral split-brain**: tests may verify the Node path while production executes the Worker path.

V3 target:

- public production `/v1/*` logic lives in Worker only.
- `app.ts` owns admin/read-only observability endpoints.
- either remove the Node `/v1` handler or expose it only through an explicit test/dev adapter built from the same shared gateway primitives.
- do not maintain two independent public gateway implementations.

---

## `src/server/router.ts`

**Decision: RETIRE FROM PRODUCTION, THEN DELETE**

Reason:

- it implements candidate selection/failover that V3 assigns exclusively to OmniRoute.
- keeping it reachable would create a second router.

Do not add new `router.ts` unit tests merely to preserve obsolete architecture.

Archive historical behavior if required for traceability, but no production import.

---

## `src/server/health.ts`

**Decision: RETIRE FROM PRODUCTION**

Direct provider probing from secure-ai-router can diverge from OmniRoute's own provider state.

V3:

- provider health shown in UI must come from OmniRoute authoritative telemetry/API.
- do not independently mutate D1 provider health.
- if OmniRoute cannot expose a value, display **unknown**, not a fabricated substitute.

---

## `src/server/policy.ts`

**Decision: SPLIT**

- Retire provider/model routing policy enforcement.
- Keep only genuinely required generic security helpers, moved to a clearly named security module.
- Do not let “policy” become a hidden second routing authority.

---

## `src/server/firewall.ts`

**Decision: EXPLICIT PRODUCT DECISION; OFF FROM INITIAL THIN-GATEWAY CONTRACT**

The unified plan describes a thin auth/rate-limit/log/passthrough edge.

Therefore:

- do not silently block prompts in production unless this is an explicitly retained requirement.
- if retained later, it needs its own documented policy contract, tests, event schema, bypass rules, and admin behavior.
- Worker and dev path must enforce the exact same policy.

---

## `src/server/crypto.ts`

**Decision: CONDITIONAL**

The `_env` implementation is directionally stronger than `bun` (versioned AES-GCM + stronger derivation/backward compatibility), but first ask whether V3 needs to store provider credentials at all.

Preferred:

- if provider credentials live only in OmniRoute, **delete this V3 credential-encryption subsystem**.
- if V3 still owns a secret field, take the `_env` crypto direction only after migration, corruption, wrong-key and restart tests.

---

## `src/server/db/schema.ts`

**Decision: REPLACE ROUTING-CENTRIC SCHEMA WITH OBSERVABILITY SCHEMA**

Current schema carries:

- providers
- models
- policies
- routing decisions
- request attempts
- provider health fields

Those tables encode the old local-router architecture.

V3 should not use them as independent routing truth.

Recommended minimal request table:

```sql
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  api_key_id TEXT,
  path TEXT NOT NULL,
  status INTEGER,
  latency_ms INTEGER,
  requested_model TEXT,
  provider TEXT,
  selected_model TEXT,
  error TEXT,
  correlation_id TEXT,
  streaming INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_requests_ts ON requests(ts);
CREATE INDEX idx_requests_key ON requests(api_key_id);
CREATE INDEX idx_requests_correlation ON requests(correlation_id);
```

Rules:

- `provider = NULL` unless OmniRoute provides authoritative provider metadata.
- `selected_model = NULL` unless authoritative upstream data proves it.
- cost = unknown unless authoritative cost data exists.
- no generated/random health, latency, routing or cost values.

Optional V3 tables:

- `api_keys` — if D1 remains the public gateway key store.
- `security_events` — real auth/rate-limit/system events.
- `audit_log` — real admin changes.

Do not carry `routing_decisions` / `request_attempts` forward unless OmniRoute exports authoritative attempt/routing events.

---

## `src/server/db/d1.ts`

**Decision: KEEP / ADAPT**

Keep the D1 adapter if Drizzle remains useful, but bind it to the V3 schema and a verified dedicated resource.

Do not write new tables into an existing D1 until its actual current purpose/schema is inspected.

---

## `src/server/db/node.ts`

**Decision: DEV/TEST ONLY, REWORK**

Remove:

- fake/demo provider seeding.
- default admin secret behavior.
- simulated/periodic provider health state.

Local DB, if retained, should mirror the V3 observability schema only.

---

## `server.ts`

**Decision: TAKE SELECTED `_env` IMPROVEMENTS**

Keep:

- loopback binding (`127.0.0.1`).
- corrected SPA static serving if local dashboard serving is needed.

Review/remove:

- environment behavior that makes Node act like a second production gateway.
- periodic provider health routines.
- runtime divergence from Worker.

Preferred production-path development tool: `wrangler dev`.

---

## `wrangler.toml`

**Decision: KEEP STRUCTURE, VERIFY EVERY RESOURCE**

Candidate B (`omniroute-edge` as an isolated Worker) remains the cleaner architectural direction, but V3 must verify:

- account/resource ownership.
- dedicated/safe D1.
- routes/hostnames.
- origin.
- secrets set through Worker secret mechanisms, never literal config.
- no accidental overlap with unrelated MCP resources.

---

# 4. Authentication merge matrix

## Public gateway auth

Keep the current fail-closed principle:

```text
no configured auth -> 503
missing/bad token   -> 401
valid gateway token -> allowed to public gateway only
```

Normalize production auth:

- document whether gateway keys are D1/bcrypt, a single Worker secret, or both during migration.
- do not silently allow competing auth mechanisms forever.
- never store raw long-lived keys in D1.
- update `lastUsedAt` only after a real successful key match.
- gateway credential must not authorize admin endpoints.

## Admin auth

`_env/src/auth/adminAuth.ts` introduces:

```ts
localStorage value || 'admin_secret'
```

**Decision: REJECT / REVERT**

No synthetic browser fallback credential.

Target:

```text
Cloudflare Access
      |
      v
Admin Dashboard / Admin API
```

If an app-level owner token remains as break-glass:

- no hard-coded default.
- explicit configuration.
- fail closed when absent.
- separate trust boundary from gateway keys.

---

# 5. Admin/control-plane endpoint decisions

| Surface | V3 mode |
|---|---|
| API Keys | Real admin CRUD/revoke for gateway keys; masked output only. |
| Providers | **Read-only** until wired to a real OmniRoute management API. |
| Models | **Read-only** until wired to OmniRoute. |
| Routing rules | Hide/retire unless they change real OmniRoute routing. |
| Provider health actions | Remove local probes; use OmniRoute authoritative state. |
| Security policies | Keep only policies actually enforced in deployed runtime. |
| Firewall settings | Hide unless firewall is explicitly part of V3 runtime contract. |
| Logs | Real edge/D1 logs. |
| Analytics | Aggregations over real V3 telemetry. |
| Alerts | Derived from real telemetry; unknown stays unknown. |
| Traces | Request/correlation traces from real runtime evidence. |
| Audit log | Real admin changes only. |
| Settings | Only settings that actually affect deployed runtime. |

**Forbidden:** UI mutation that updates only D1 while implying OmniRoute changed.

---

# 6. Frontend file merge matrix

## `_env`-only files

### `LoginView.tsx`
**Decision: KEEP ONLY AS VISUAL REFERENCE OR REWIRE**

Current form is not real authentication; it accepts input and navigates to a loading page.

Do not present it as a security boundary.

### `LoadingView.tsx`
**Decision: REMOVE FROM AUTH SECURITY FLOW**

Current timed “checks” are presentation, not real verification.

May be reused only as an honestly-labelled generic transition screen.

### `Logo.tsx`
**Decision: KEEP IF BRANDING IS DESIRED**

### `WavyBackground.tsx`
**Decision: KEEP IF BRANDING IS DESIRED**

---

## Changed files

### `src/App.tsx`
**Decision: MERGE SELECTIVELY**

Keep useful route/layout cleanup, but do not expose `/login` + `/loading` as if they establish real authentication.

Final route guard must align with Cloudflare Access / real session behavior.

### `src/auth/adminAuth.ts`
**Decision: TAKE `bun` SAFETY BEHAVIOR, THEN REDESIGN**

Never fall back to `admin_secret`.

### `ApiKeysView.tsx`
**Decision: TAKE `_env` DIRECTION**

Use admin-authenticated endpoints. Add:

- real error states.
- masked key contract.
- one-time raw-key display only at creation if supported.
- no public unauthenticated key listing.

### `CentralHubCard.tsx`
**Decision: TAKE `_env` AFTER VISUAL TEST**

### `DashboardView.tsx`
**Decision: TAKE `_env` AFTER DATA-CONTRACT REVIEW**

Every KPI/label must map to a real V3 telemetry field.

### `KpiCard.tsx`
**Decision: TAKE `_env` AFTER VISUAL TEST**

### `TopologyMap.tsx`
**Decision: REVIEW / MERGE CAREFULLY**

Decorative colors must not imply provider health/status.

Semantic status styling must come from real data.

### `src/index.css`
**Decision: TAKE `_env` UI CHANGES IF SCREENSHOT REGRESSION PASSES**

---

## Initially unchanged components

These can be carried into the V3 working tree, but their **data semantics must be revalidated**:

- `AlertsView.tsx`
- `AnalyticsView.tsx`
- `AppShell.tsx`
- `AuditLogView.tsx`
- `BootstrapAdminCard.tsx`
- `EditProviderModal.tsx`
- `FirewallView.tsx`
- `GlobalEdgeTrafficCard.tsx`
- `Header.tsx`
- `LogsView.tsx`
- `ModelsView.tsx`
- `ProviderHealthCard.tsx`
- `ProviderLogos.tsx`
- `ProvidersView.tsx`
- `RecentDecisionsTable.tsx`
- `RoutingRulesView.tsx`
- `SecurityPoliciesView.tsx`
- `SettingsView.tsx`
- `Sidebar.tsx`
- `StatusBadge.tsx`
- `TopologyView.tsx`
- `TracesView.tsx`
- `WorldMapPattern.tsx`
- topology/format helpers
- general formatters

A visually unchanged component is **not automatically semantically valid** after the router architecture changes.

---

# 7. Existing test decisions

| Test | V3 decision |
|---|---|
| `_env/src/server/__tests__/auth.test.ts` | Keep intent, but production auth coverage must move to Worker-path tests. |
| `_env` `failover.test.ts` | Rename/rewrite. It no longer tests failover; it tests a Node OmniRoute proxy path. |
| `bun/api-keys.test.ts` | Do not restore unchanged. Replace with admin-only masked-key tests. |
| `policy.test.ts` | Retire with local routing policy; retain only tests for any explicit edge security policy. |
| `topology.test.ts` | Keep, but drive it from authoritative observability data. |
| local router tests | Do not add if local router is intentionally retired. |
| local provider-health tests | Do not add if local health probing is retired. |

---

# 8. Mandatory new V3 tests

## A. Worker auth

- no configured gateway auth -> `503`
- missing token -> `401`
- bad token -> `401`
- valid gateway token -> request reaches OmniRoute
- gateway token does not grant admin access
- raw client Authorization is never forwarded to OmniRoute

## B. Origin safety

- missing origin -> `503`
- malformed origin -> `503`
- non-HTTPS public origin -> `503`
- localhost/loopback allowed only in local development policy
- origin credential, if configured, replaces the client credential

## C. Rate limiting

- limit exceeded -> `429`
- rejected request never reaches OmniRoute
- separate API keys have separate budgets
- rate-limit event is observable
- edge/coarse and app/per-key limits are independently testable

## D. Streaming

- upstream chunks remain incremental
- gateway does not fully buffer body
- request/correlation IDs exist on both sides
- client disconnect does not create false success evidence
- no edge retry/fallback after stream begins

## E. D1 telemetry

- one real request -> one request record
- auth failure is not falsely logged as a successful upstream call
- latency/status/path/key ID are real
- provider/model fields remain NULL when not authoritative
- upstream network failure is recorded honestly
- no duplicate request lifecycle rows

## F. Admin boundary

- unauthenticated admin request rejected/redirected by actual chosen boundary
- no `admin_secret` fallback
- public gateway credential cannot call admin mutations

## G. Artifact sanitization

Final source/release contains no:

- `.env`
- real secret values
- `*.db`
- raw provider credential dumps
- decrypted key exports
- scratch raw runtime data

## H. Artifact provenance

- exact source revision identified
- clean build generated from that revision
- generated manifest hashes every release file
- deployment consumes that exact artifact
- deployed version is verified against the same artifact/version

---

# 9. Recommended Worker V3 flow

```text
1. Parse request
2. Authenticate public gateway key
3. Resolve safe key identity / tenant metadata
4. Enforce per-key rate limit
5. Generate/propagate X-Request-ID
6. Generate/propagate X-Correlation-ID
7. Start minimal telemetry
8. Strip public credential
9. Add origin credential if configured
10. Forward unchanged path/query/body to OmniRoute
11. Return upstream body as real stream
12. Finalize status/latency/error telemetry asynchronously where safe
```

Failure rules:

```text
auth unavailable            -> 503
bad/missing auth            -> 401
rate limit                  -> 429
origin unavailable/invalid  -> 503
origin network failure      -> honest 5xx
OmniRoute 4xx/5xx           -> preserve meaningful upstream status
provider unknown            -> NULL / unknown
selected model unknown      -> NULL / unknown
```

Never:

- choose provider at edge
- retry another provider at edge
- fabricate routing decisions
- infer provider from stale D1 config
- invent health/cost/latency

---

# 10. Implementation order

## Phase V3-0 — Freeze + sanitize

1. Create a new V3 working tree from `_env`.
2. Preserve `bun`/`bun(1)` read-only as baseline.
3. Remove secret/runtime artifacts.
4. harden ignore/release rules.
5. scan source/artifact for known secret patterns without printing values.
6. rotate any exposed production credentials outside the source workflow.

**Exit:** sanitized tree; no source behavior changed yet.

---

## Phase V3-1 — Package determinism

1. choose npm.
2. reconcile `package.json`.
3. remove Bun/pnpm lock/workspace files.
4. generate one `package-lock.json`.
5. prove clean `npm ci`.
6. run typecheck/tests/build.
7. no embedded stale ZIP deployer.

**Exit:** one package-manager truth and reproducible restore/build.

---

## Phase V3-2 — Single gateway runtime

1. make Worker the only production `/v1/*` implementation.
2. remove or dev-isolate Hono `/v1` duplication.
3. retire local `router.ts`.
4. retire local provider health probing.
5. remove D1-only provider/routing mutations from production semantics.

**Exit:** exactly one production request path and one routing authority.

---

## Phase V3-3 — Edge controls + telemetry

1. per-key rate limiting.
2. Worker D1 telemetry.
3. correlation IDs.
4. honest streaming error/finalization behavior.
5. minimal V3 observability schema.

**Exit:** MD edge-gateway responsibilities are real in production path.

---

## Phase V3-4 — Dashboard truthfulness

1. repoint Dashboard/Topology/Logs/Analytics/Alerts/Traces to V3 telemetry.
2. hide/disable local provider/model/routing mutations.
3. replace stale routing terminology.
4. unknown values render as unknown.
5. API key admin remains real and masked.

**Exit:** UI cannot claim state the runtime has not proven.

---

## Phase V3-5 — Real admin protection

1. Cloudflare Access or explicitly selected real owner boundary.
2. remove fake login security flow.
3. no browser default secrets.
4. verify unauthenticated admin rejection externally.

**Exit:** real admin boundary demonstrated.

---

## Phase V3-6 — Deployment provenance

1. build exact artifact.
2. generate SHA-256 manifest.
3. deploy exact artifact.
4. capture Worker version/deployment identity.
5. run production verification against that version.
6. only then create release/checkpoint report.

**Exit:** source -> build -> artifact -> deployment -> verification is one traceable chain.

---

# 11. Canonical documentation structure

V3 should stop treating multiple root reports as competing truths.

Recommended:

```text
PROJECT-STATE.md               # current canonical state
docs/
  architecture/
    TARGET-ARCHITECTURE.md
  verification/
    ACCEPTANCE-MATRIX.md
  checkpoints/
    ...
  history/
    CP04-CP05-VERIFIED-REPORT.md
    DASHBOARD-HUB-WORK-SUMMARY.md
    DEPLOYMENT-NOTE.md
    ENV-WORK-REPORT.md
    MERGE-REPORT.md
    RELEASE-DELIVERY-2026-09-12.md
  reference/
    cloudflare-ai-router-1368x753.html
```

`PROJECT-STATE.md` should contain:

- canonical source/version
- architecture
- active runtime paths
- security boundaries
- implemented capabilities
- verification status
- artifact/deployment identity
- known blockers
- next bounded milestone
- links to historical evidence

Historical reports remain evidence; they do not override current state.

---

# 12. Release acceptance matrix

V3 is **not FINAL** until the same exact source/artifact proves all applicable items:

- [ ] sanitized source contains no runtime secrets/databases/raw key exports
- [ ] one package manager + one lockfile
- [ ] clean dependency restore succeeds
- [ ] TypeScript check succeeds
- [ ] test suite succeeds with no failure hidden as skip
- [ ] production Worker `/v1` is the tested gateway path
- [ ] invalid key -> 401 before origin
- [ ] auth-unconfigured -> fail closed
- [ ] per-key rate limit -> 429
- [ ] real streamed response remains streamed
- [ ] edge performs no provider selection/fallback
- [ ] OmniRoute performs actual routing/fallback
- [ ] D1 request telemetry reflects real edge traffic
- [ ] Dashboard reads real V3 telemetry
- [ ] provider/model/routing controls are read-only or truly wired to OmniRoute
- [ ] admin is protected by real access control
- [ ] external origin/VPS exposure matches intended design
- [ ] release manifest matches exact artifact
- [ ] deployer deploys exact verified artifact
- [ ] deployed version identity recorded
- [ ] production verification performed against that exact deployment
- [ ] any exposed credentials used during work are rotated
- [ ] `PROJECT-STATE.md` updated from actual evidence

**BLOCKED / SKIP / UNVERIFIED are never PASS.**

---

# 13. Immediate next implementation task

The first coding task should be intentionally small:

> **Create the sanitized Canonical V3 working tree and establish package/build reproducibility without changing routing behavior.**

This prevents security/package ambiguity from being mixed with architecture changes.

Expected output of that task:

1. sanitized source tree
2. one npm lockfile
3. no secret/runtime artifacts
4. regenerated package manifest
5. actual `npm ci` output
6. actual typecheck output
7. actual test output
8. actual build output
9. list of remaining architecture changes for V3-2

Only after V3-0/V3-1 pass should the Worker/runtime refactor begin.
