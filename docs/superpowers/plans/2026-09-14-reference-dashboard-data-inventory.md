# Reference Dashboard + Data Inventory Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with TDD. This extracted workspace is already an isolated copy of the uploaded package; no Git worktree is available in the package.

**Goal:** Deliver a testable package whose 1368×753 dashboard remains faithful to the supplied Cloudflare AI Router reference while loading the complete provider/model/database inventory and placing provider credentials and gateway API-key metadata in their correct control-plane surfaces.

**Architecture:** Preserve the existing V3.2 React/Hono/Drizzle architecture. OmniRoute remains the routing authority; SQLite is an explicitly non-authoritative inventory snapshot; gateway/admin keys remain hashed metadata and provider credentials remain encrypted-at-rest fields that are never returned raw. The dashboard may summarize records, but full Providers/Models/API Keys workspaces must make the complete inventory reachable without silent truncation.

**Tech Stack:** React 19, TypeScript, Vite, Hono, Drizzle ORM, libSQL/SQLite, Vitest, Node test runner.

**Spec:** `OmniRoute-SecureAI-Router-Deep-Architecture-Upgrade-Plan(1).md` / uploaded revision 2.0 architecture specification.

## Global Constraints

- OmniRoute is the sole provider/model routing, retry, and fallback authority.
- No fabricated health, traffic, latency, quota, cost, routing decision, uptime, alert, or geo state.
- Local SQLite is snapshot/reference inventory, not live health authority.
- Provider credential material must never be returned to the browser; only a boolean credential-presence marker may be exposed.
- Raw gateway/admin API keys are shown only once on creation and are never stored plaintext.
- All 26 provider records and all 433 model records in the supplied snapshot must remain reachable.
- Local verification is not Cloudflare production verification.

---

### Task 1: Safe provider credential-presence contract

**Files:**
- Modify: `src/server/app.ts`
- Modify: `src/components/ProvidersView.tsx`
- Test: `test-node/provider-inventory-completeness.test.mjs`

**Produces:** public provider inventory rows include `hasApiKey: boolean` while never exposing `apiKeyEncrypted`; Providers UI displays credential configuration separately from live health.

### Task 2: API-key inventory state and secure loading

**Files:**
- Modify: `src/components/ApiKeysView.tsx`
- Modify: `src/App.tsx`
- Test: `test-node/api-key-workspace-contract.test.mjs`

**Produces:** API Keys workspace receives readiness counts from the already-loaded DB state, distinguishes locked metadata from an empty DB, and continues to require admin authorization for the actual masked-key list and mutations.

### Task 3: No silent dashboard/provider truncation semantics

**Files:**
- Modify: `src/components/ProviderHealthCard.tsx`
- Modify: `src/components/TopologyMap.tsx`
- Test: `test-node/reference-dashboard-data-contract.test.mjs`

**Produces:** dashboard provider card explicitly states when it is a six-row summary and links to the full inventory; topology keeps paginated access to all providers instead of implying the first page is the complete inventory.

### Task 4: Reference-board copy and provenance polish

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/TopologyMap.tsx`
- Modify: `src/index.css` only if needed for layout fidelity.
- Test: `test-node/reference-dashboard-data-contract.test.mjs`

**Produces:** search/header/topology copy visually matches the supplied reference while remaining truthful about data sources.

### Task 5: Database and package verification

**Files:**
- Add/update: `IMPLEMENTATION-VERIFICATION.md`

**Verification:**
- `npm run verify:data`
- `node --experimental-strip-types --test test-node/*.test.mjs`
- `npm run lint` if dependencies restore
- `npm test` if dependencies restore
- `npm run build` if dependencies restore
- inspect SQLite counts and foreign-key integrity
- package the completed source without `.env`, `node_modules`, `dist`, `.wrangler`, or QA browser profiles.
