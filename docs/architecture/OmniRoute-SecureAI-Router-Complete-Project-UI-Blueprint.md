# OmniRoute + Secure-AI-Router — Complete Project, UI, Runtime, Cloudflare, and Delivery Blueprint

Status date: 2026-09-14
Purpose: single-source technical handoff covering what is known, what is implemented, what is only reported, what is blocked, what remains unimplemented, and how the two UIs divide responsibility.
Language: English.
This document is intentionally detailed and line-oriented so it can be handed to another coding agent without requiring the user to restate project history.

## 0. Evidence Labels

- **INVARIANT** — A project rule that must remain true unless explicitly changed by the owner.
- **VERIFIED-CODE** — Observed in current source, configuration, tests, or build output.
- **VERIFIED-RUNTIME** — Observed against the installed OmniRoute runtime.
- **VERIFIED-LOCAL** — Verified on the local Windows host only; not proof of Cloudflare behavior.
- **VERIFIED-CLOUDFLARE** — Reserved for evidence from an actual Cloudflare deployment.
- **REPORTED** — Previously reported by another coding agent and not fully reverified in the latest pass.
- **PLANNED** — Agreed design or architecture direction that is not complete.
- **NOT-IMPLEMENTED** — Known required capability or product surface that is still missing.
- **BLOCKED** — Cannot truthfully be marked complete because required evidence or infrastructure is missing.
- **REFERENCE-ONLY** — Useful for visual/design/future-version comparison but not runtime authority.

## 1. Executive Summary

- **INVARIANT:** OmniRoute is the sole execution plane and routing authority.
- **INVARIANT:** Provider selection, model selection, retry, fallback, Combo execution, and final route choice belong to OmniRoute.
- **INVARIANT:** Secure-AI-Router is the control plane, normalized API layer, observability layer, configuration surface, and primary product UI.
- **INVARIANT:** Cloudflare is the public edge, deployment substrate, transport boundary, rate-limit layer, static-asset host, and a source of edge telemetry.
- **INVARIANT:** D1 is a durable read model/telemetry/index store, not the routing authority.
- **INVARIANT:** Secure-AI-Router must not reconstruct a winner, routing score, fallback chain, remaining quota, or routing reason that OmniRoute did not provide.
- **INVARIANT:** Unknown data stays Unknown, Unavailable, Not observed, Not configured, null, or `—`.
- **INVARIANT:** Local SQLite is snapshot/reference unless a specific live contract proves otherwise.
- **INVARIANT:** Local verification and Cloudflare verification are separate evidence because geography, colo, headers, DNS, origin path, TLS, rate limiting, and network behavior can differ.
- **INVARIANT:** Production Cloudflare resources are not mutated merely to test an uncertain configuration.
- **INVARIANT:** BLOCKED, SKIP, UNVERIFIED, and NOT-RUN are never reported as PASS.
- **CURRENT PROJECT ROOT:** `C:\project\OmniRoute_SecureAIRouter_\OmniRoute-Edge-COMPLETE-PROJECT-WITH-DEPLOYER\OmniRoute-Edge-Complete-Project`.
- **CURRENT ISOLATED OMNIROUTE ROOT:** `C:\project\OmniRoute-Runtime`.
- **CURRENT OMNIROUTE VERSION:** 3.8.50.
- **CURRENT WORKER ENTRY:** `src/worker.ts`.
- **CURRENT WORKER NAME:** `omniroute-edge`.
- **CURRENT PRODUCTION D1 NAME:** `omniroute-edge-db`.
- **CURRENT PRODUCTION D1 ID:** still the all-zero fail-closed placeholder in committed `wrangler.toml`.
- **CURRENT OMNIROUTE_ORIGIN:** empty in committed production configuration.
- **CURRENT RELEASE STATE:** stable enough for bounded handoff, not production-ready, not release-verified FINAL.
- **LATEST LOCAL QUALITY GATES:** lint/typecheck PASS; Vitest 41/41 PASS; build PASS; data verification PASS; Node tests 44/45 because static safety still fails.
- **CURRENT SECURITY BLOCKER:** OmniRoute was observed listening on `0.0.0.0` with inference API-key enforcement disabled.
- **CURRENT RUNTIME BLOCKER:** Node.js 22.22.0 was below OmniRoute 3.8.50 secure minimum 22.22.2+ for the 22.x line.

## 2. Canonical Sources of Truth

- Canonical source tree: `C:\project\OmniRoute_SecureAIRouter_\OmniRoute-Edge-COMPLETE-PROJECT-WITH-DEPLOYER\OmniRoute-Edge-Complete-Project`.
- Architecture source in repository: `docs/architecture/OmniRoute-SecureAI-Router-Deep-Architecture-Upgrade-Plan.md`.
- Earlier attached architecture reference: `OmniRoute-SecureAI-Router-Deep-Architecture-Upgrade-Plan(1).md`, approximately 3851 lines, dated 2026-09-14.
- Visual UI reference: `@Cloudflare_AI_Router_Transparent_DesignSpace_1368x753_v2.zip`.
- The visual reference is REFERENCE-ONLY; it is not data truth or runtime truth.
- Installed OmniRoute 3.8.50 runtime is the authority for current local endpoint behavior.
- Previously inspected OmniRoute 3.8.51 source is REFERENCE-ONLY for forward compatibility.
- `wrangler.toml` is the current Cloudflare deployment contract and intentionally fails closed for production readiness.
- Project tests are executable behavior and safety contracts.

## 3. Responsibility Boundaries

- **Provider selection:** owner = **OmniRoute**. Secure-AI-Router may display the selected provider only when source evidence exists.
- **Model selection:** owner = **OmniRoute**. Secure-AI-Router must not infer the winning model.
- **Retry/fallback:** owner = **OmniRoute**. Secure-AI-Router may display observed attempts/outcomes but never synthesize them.
- **Combo execution:** owner = **OmniRoute**. The product can manage Combos only through verified management contracts.
- **Routing explainability:** owner = **OmniRoute**. Official factors/scores/reasons can be shown as OmniRoute-derived.
- **Primary operator UI:** owner = **Secure-AI-Router**. This is the product cockpit.
- **Low-level engine admin UI:** owner = **OmniRoute**. This is the engineering/maintenance panel.
- **Public edge auth/rate limit:** owner = **Cloudflare + Secure-AI-Router**. Protects product entry points.
- **Read-model persistence:** owner = **D1**. Stores durable copies/indexes without taking routing authority.
- **Snapshot/reference data:** owner = **Local SQLite**. May be used with explicit non-authoritative provenance.
- **Provider credentials:** owner = **OmniRoute secure configuration**. Secrets must not be exposed in product UI/logs.
- **Deployment:** owner = **Cloudflare Workers**. Final public target for UI/control-plane edge.

## 4. High-Level Architecture

```text
User / Operator / API Client
            |
            v
+----------------------------------------------+
| Secure-AI-Router Product UI                  |
| React / Vite                                 |
| Primary operator experience                  |
+----------------------+-----------------------+
                       |
                       | /api/v2/*
                       v
+----------------------------------------------+
| Secure-AI-Router Control Plane               |
| validation -> service -> adapter/repository  |
| normalized domain -> API envelope            |
+-------------+-------------------+------------+
              |                   |
              v                   v
+---------------------------+   +------------------------------+
| OmniRoute Management /    |   | Cloudflare + D1             |
| Telemetry / Explainability|   | edge facts + read models     |
+-------------+-------------+   +------------------------------+
              |
              v
+----------------------------------------------+
| OmniRoute Execution Plane                    |
| routing / provider / model / retry / fallback|
+----------------------+-----------------------+
                       |
                       v
              External AI Providers
```

## 5. Mandatory Backend Flow

- 01. HTTP route receives the request.
- 02. Route validates parameters/body.
- 03. Route calls an application service.
- 04. Service calls an adapter or repository.
- 05. Adapter/repository talks to the actual source.
- 06. Raw source data is schema-validated.
- 07. Raw source data is normalized into domain types.
- 08. Provenance is attached.
- 09. Capability limitations are preserved.
- 10. Service returns a domain result.
- 11. API route wraps the result in the standard envelope.
- 12. UI renders according to source, capability, and confidence.

## 6. Provenance and Truth Model

- **Observed edge fact:** Directly observed by Cloudflare/Secure-AI-Router, for example request status, edge timing, or request identifiers.
- **Observed OmniRoute outcome:** Persisted or runtime-returned execution outcome originating from OmniRoute.
- **OmniRoute-derived explainability:** Scores/factors/candidates/reasons computed by OmniRoute itself. Allowed when labeled as derived/explainability.
- **Snapshot/reference:** Local/static source used as fallback. Non-authoritative by definition.
- **D1 read model:** Durable copy/index for correlation/query. Storage authority is D1; execution authority remains OmniRoute.
- **Unavailable:** Source/capability cannot currently be used.
- **Not observed:** Field/event may conceptually exist but was not captured for this item.
- **Not configured:** Feature exists but required configuration is absent.
- **Unknown:** No trustworthy value is known.

### 6.1 Three Routing Information Categories

- Category 1 — Observed outcome: actual provider/model/outcome evidence when present.
- Category 2 — OmniRoute-owned explainability: official scores/factors/candidates/reasons from OmniRoute.
- Category 3 — Secure-AI-Router inference: locally reconstructed winner/score/fallback/quota/reason. Forbidden.

## 7. OmniRoute 3.8.50 Runtime Facts

- **VERIFIED-RUNTIME:** CLI reports version 3.8.50.
- **VERIFIED-LOCAL:** dashboard expected at `http://localhost:20128`.
- **VERIFIED-LOCAL:** OpenAI-compatible API base expected at `http://localhost:20128/v1`.
- **VERIFIED-RUNTIME:** management endpoints require authentication.
- **VERIFIED-RUNTIME:** unauthenticated management probes reject with an auth error.
- **VERIFIED-RUNTIME:** public monitoring can return only `{status, setupComplete}`.
- **VERIFIED-RUNTIME:** reduced public health must not populate detailed provider/runtime health.
- **VERIFIED-RUNTIME:** richer authenticated health is acceptable only when actually returned and validated.
- **VERIFIED-RUNTIME:** routing explainability path is `/api/v1/explain/routing`.
- **VERIFIED-RUNTIME:** `/api/routing/decisions/{requestId}` is absent in 3.8.50.
- **VERIFIED-RUNTIME:** Auto Combo candidate read endpoints assumed from 3.8.51 are absent in 3.8.50.
- **VERIFIED-RUNTIME:** Combo CRUD exists in the 3.8.50 contract.
- **VERIFIED-RUNTIME:** `/api/combos/test` exists.
- **BLOCKED:** Combo writes/test remain disabled in Secure-AI-Router until concurrency/revision/non-destructive semantics are proven.
- **VERIFIED-RUNTIME:** health routes include `/api/memory/health`.
- **VERIFIED-RUNTIME:** health routes include `/api/settings/qdrant/health`.
- **VERIFIED-RUNTIME:** health routes include `/api/usage/cache-health`.
- **VERIFIED-RUNTIME:** health routes include `/api/storage/health`.
- **VERIFIED-RUNTIME:** health routes include `/api/health`.
- **VERIFIED-RUNTIME:** health routes include `/api/monitoring/health`.
- **VERIFIED-RUNTIME:** health routes include `/api/token-health`.
- **VERIFIED-RUNTIME:** quota routes include `/api/quota/pools`.
- **VERIFIED-RUNTIME:** quota routes include `/api/quota/pools/{id}`.
- **VERIFIED-RUNTIME:** quota routes include `/api/quota/pools/{id}/usage`.
- **VERIFIED-RUNTIME:** quota routes include `/api/quota/plans`.
- **VERIFIED-RUNTIME:** quota routes include `/api/quota/plans/{connectionId}`.
- **VERIFIED-RUNTIME:** quota routes include `/api/quota/preview`.
- **VERIFIED-RUNTIME:** quota-store settings exist under `/api/settings/quota-store`.
- **VERIFIED-RUNTIME:** breaker search surfaced only `POST /api/resilience/reset` in the examined contract.
- **VERIFIED-RUNTIME:** cooldown read search returned no matching read API.
- **VERIFIED-RUNTIME:** lockout read search returned no matching read API.
- **VERIFIED-RUNTIME:** webhook search returned no current OpenAPI webhook surface in the inspected 3.8.50 runtime.
- **SECURITY BLOCKER:** Node 22.22.0 was below the secure minimum 22.22.2+ for 22.x.
- **SECURITY BLOCKER:** runtime warned it was listening on `0.0.0.0` with no inference API-key requirement.

## 8. OmniRoute UI Role

- OmniRoute UI is not the final Secure-AI-Router product UI.
- OmniRoute UI is the low-level engine administration and maintenance surface.
- It is appropriate for initial bootstrap.
- It is appropriate for direct provider credential setup.
- It is appropriate for native provider connection testing.
- It is appropriate for native Combo administration.
- It is appropriate for low-level runtime troubleshooting.
- It is appropriate for recovery when the product control plane is unavailable.
- It should not be the primary public-facing application.
- It should not be exposed openly to the internet without deliberate auth/network hardening.
- Installed UI source shows a dedicated login flow.
- Installed UI source calls `/api/auth/login`.
- Installed UI source exposes onboarding steps equivalent to welcome, tiers, security, provider, test, and done.
- Onboarding can enable `requireLogin` and set a password via `/api/settings/require-login`.
- Onboarding can add a provider directly to OmniRoute.
- Onboarding can test the provider connection.
- Onboarding can mark setup complete and enter the native dashboard.
- Advanced engine features may intentionally remain OmniRoute-UI-only even after Secure-AI-Router matures.

## 9. Secure-AI-Router UI Role

- Secure-AI-Router UI is the primary product cockpit.
- It should become the normal day-to-day operator interface.
- It unifies edge, read-model, runtime, and reference data without erasing source provenance.
- It can present Providers, Models, Combos, Routing, Requests, Traces, Metrics, Alerts, Topology, System, Cloudflare, and Settings.
- It must not implement its own provider selection logic.
- It must not implement fallback routing.
- It must not invent health, latency, cost, quota, traffic, geo, routing decisions, fallback attempts, uptime, alerts, login state, or progress.
- It must distinguish API unavailable from empty dataset.
- It must distinguish unknown from zero.
- It must distinguish not configured from offline.
- It must distinguish OmniRoute-derived from Cloudflare-observed.
- It must distinguish local verification from Cloudflare verification.
- Controls are enabled only when backend capability is proven.
- Unsafe/unverified writes remain disabled.
- It may offer deep links to OmniRoute admin for authorized operators.

## 10. Visual Design Direction

- Visual reference package: `@Cloudflare_AI_Router_Transparent_DesignSpace_1368x753_v2.zip`.
- Target visual design space is 1368×753.
- The reference informs cards, spacing, sidebar, hierarchy, topology composition, provider presentation, and overall polish.
- The reference does not make a metric or capability real.
- Existing React/Vite frontend should evolve in place rather than being destructively replaced.
- Professional control-plane feel is preferred over a demo dashboard.
- Semantic colors must communicate state without overstating certainty.
- Empty states must explain unavailable vs not configured vs not observed vs truly empty.
- Provenance should be visible but not visually overwhelming.
- Write actions must look distinct from read-only state.
- Test and production environments should be visually distinct.

## 11. UI Truthfulness Contracts Already Covered by Tests

- **VERIFIED-CODE:** Canonical UI does not expose a local provider edit modal that would imply local routing authority.
- **VERIFIED-CODE:** Control-plane pages do not claim a local router or active prompt firewall.
- **VERIFIED-CODE:** Provider/model pages do not expose local routing mutations.
- **VERIFIED-CODE:** Every secondary surface exposes a truthful data/source contract.
- **VERIFIED-CODE:** Metrics is a dedicated purpose-built page/route.
- **VERIFIED-CODE:** Secondary surfaces do not hard-code screenshot/demo operational values.
- **VERIFIED-CODE:** Settings does not claim a local routing engine or inline firewall.
- **VERIFIED-CODE:** Dashboard no longer carries the obsolete local-router settings type.
- **VERIFIED-CODE:** Topology workspace is read-only and does not claim local scoring/firewall execution.
- **VERIFIED-CODE:** Dashboard source does not hard-code screenshot operational metrics.
- **VERIFIED-CODE:** Logs expose only observed request facts and nullable usage/cost.
- **VERIFIED-CODE:** Traces are edge request traces, not fabricated routing-score explorers.
- **VERIFIED-CODE:** Sidebar does not present legacy snapshot provider health as live network health.
- **VERIFIED-CODE:** Alerts copy describes the actual request-derived source.
- **VERIFIED-CODE:** Traces API does not advertise candidate scoring it does not collect.
- **VERIFIED-CODE:** Audit log does not invent current timestamps when source timestamp is absent.
- **VERIFIED-CODE:** Dashboard/navigation do not label generic edge outcomes as threats or routing decisions.
- **VERIFIED-CODE:** Topology feature badges describe implemented edge capabilities instead of screenshot-only products.
- **VERIFIED-CODE:** Alerts distinguish API-unavailable from real empty data.
- **VERIFIED-CODE:** Header/sidebar do not invent environment, operator identity, or gateway health.
- **VERIFIED-CODE:** Topology/header controls do not imply search/filter behavior they do not execute.
- **VERIFIED-CODE:** Completed UI still forbids fabricated screenshot metrics and local-router claims.

## 12. Screen-by-Screen Secure-AI-Router UI Blueprint

### 12.1 Overview / Dashboard

- **Purpose:** Primary operational summary and navigation landing page.
- **Primary sources:**
  - system status API
  - capabilities API
  - sources API
  - observed request read model
  - Cloudflare evidence when deployed
  - OmniRoute runtime status
- **Current/required behavior:**
  - No fabricated screenshot metrics.
  - No invented environment/operator/gateway health.
  - Recent activity must be source-backed.
- **Remaining/future behavior:**
  - Explicit Local vs Cloudflare verification badges.
  - Source drill-down per metric.
  - Security posture warnings.
  - Deployment identity.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.2 Providers

- **Purpose:** Normalized provider inventory and detail.
- **Primary sources:**
  - authenticated OmniRoute `/api/providers` when verified
  - local snapshot/reference fallback
- **Current/required behavior:**
  - Runtime-gated authoritative reads.
  - Snapshot fallback is non-authoritative.
  - No local routing mutation UI.
- **Remaining/future behavior:**
  - Safe provider writes after runtime verification.
  - Credential-safe management.
  - Cloudflare reachability shown separately from provider health.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.3 Models

- **Purpose:** Normalized model catalog, comparison, filters, sorting, pagination.
- **Primary sources:**
  - live OmniRoute model data
  - snapshot/reference fallback
- **Current/required behavior:**
  - Live-first behavior.
  - No silent snapshot enrichment as live truth.
  - Comparison/filter/sort/pagination direction exists.
- **Remaining/future behavior:**
  - Field-level provenance.
  - Authoritative capability metadata.
  - Cloudflare-region observations only after edge evidence.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.4 Combos

- **Purpose:** Read and eventually safely manage OmniRoute Combos.
- **Primary sources:**
  - OmniRoute Combo APIs
- **Current/required behavior:**
  - List/detail reads started.
  - Draft validation/revision/diff concepts exist.
  - Writes remain runtime-unverified.
- **Remaining/future behavior:**
  - Verified concurrency/revision semantics.
  - Safe create/update/delete.
  - Safe test action.
  - Audit/rollback.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.5 Routing Intelligence

- **Purpose:** Present OmniRoute routing explainability without recreating routing.
- **Primary sources:**
  - `/api/v1/explain/routing` on 3.8.50
  - observed/persisted request outcomes
- **Current/required behavior:**
  - 3.8.50 explainability is snapshot/current routing information.
  - No request-specific decision endpoint.
  - No Auto-candidate endpoint.
- **Remaining/future behavior:**
  - Version-gated richer APIs.
  - Clear outcome vs explainability separation.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.6 Requests / Logs

- **Purpose:** Observed request ledger.
- **Primary sources:**
  - edge observed requests
  - correlated OmniRoute persisted outcomes when available
- **Current/required behavior:**
  - Nullable token/cost fields.
  - No invented provider/model.
  - No invented attempts.
- **Remaining/future behavior:**
  - Cloudflare colo/region fields.
  - Real search/filter/export backed by queries.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.7 Traces

- **Purpose:** Request-centric timeline across edge and runtime evidence.
- **Primary sources:**
  - edge request
  - D1 correlation index
  - OmniRoute outcome
  - live explainability
- **Current/required behavior:**
  - Edge trace, not routing-score explorer.
  - Provider attempts unavailable.
  - Missing stages remain missing.
- **Remaining/future behavior:**
  - Provider attempts if real source exists.
  - Cloudflare timing stages.
  - Cross-region comparison.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.8 Metrics

- **Purpose:** Observed operational measurements.
- **Primary sources:**
  - request-derived metrics
  - future Cloudflare/Analytics Engine time series
- **Current/required behavior:**
  - Dedicated page exists/required.
  - No hard-coded demo values.
  - Nullable values preserved.
- **Remaining/future behavior:**
  - Retention windows.
  - Aggregation contracts.
  - Region/colo breakdown.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.9 Alerts

- **Purpose:** Operational alerts with source-aware availability.
- **Primary sources:**
  - real request/runtime/edge alert signals
- **Current/required behavior:**
  - Unavailable differs from empty.
  - No invented threats.
- **Remaining/future behavior:**
  - Formal rules.
  - Acknowledgement workflow.
  - Notification integrations.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.10 Topology

- **Purpose:** Read-only architecture/connectivity workspace.
- **Primary sources:**
  - configuration/capabilities/observed connectivity
- **Current/required behavior:**
  - Read-only.
  - No fake local scoring/firewall.
  - No non-functional filters.
- **Remaining/future behavior:**
  - Real Cloudflare colo/origin topology.
  - Observed traffic paths only when evidence exists.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.11 Settings

- **Purpose:** Product control-plane settings and safe proxied engine settings.
- **Primary sources:**
  - Secure-AI-Router config
  - verified OmniRoute management APIs
- **Current/required behavior:**
  - Does not claim local routing engine/firewall.
- **Remaining/future behavior:**
  - Version-gated management proxy.
  - Cloudflare config.
  - Auth/access config.
  - Advanced OmniRoute deep links.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.12 System

- **Purpose:** Status, capability, source, environment, compatibility.
- **Primary sources:**
  - `/api/v2/system/status`
  - `/api/v2/system/capabilities`
  - `/api/v2/system/sources`
  - `/api/v2/system/environment`
- **Current/required behavior:**
  - Core system APIs exist.
  - Runtime version/build only when observed.
- **Remaining/future behavior:**
  - Cloudflare build/deploy identity.
  - D1 migration status.
  - Security warnings.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.13 Sources / Provenance

- **Purpose:** Explain where operational values come from.
- **Primary sources:**
  - domain provenance metadata
- **Current/required behavior:**
  - Source/provenance concepts exist in shared contracts.
- **Remaining/future behavior:**
  - Field-level provenance popovers.
  - Freshness.
  - Authority ranking.
  - Gap explanations.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.14 Cloudflare / Deployment

- **Purpose:** Edge deployment, D1, origin, region, and release status.
- **Primary sources:**
  - Wrangler/Worker runtime
  - D1
  - Cloudflare headers/colo
  - origin health
- **Current/required behavior:**
  - Not a complete product surface yet.
  - Production config intentionally fail-closed.
- **Remaining/future behavior:**
  - Test/prod separation.
  - Worker version.
  - D1 identity.
  - Tunnel/origin health.
  - Region evidence.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

### 12.15 Authentication / Access

- **Purpose:** Secure product operator access separate from OmniRoute management login.
- **Primary sources:**
  - product auth/session
  - OmniRoute auth for engine admin
- **Current/required behavior:**
  - Tests forbid default browser admin secret fallback.
  - DB bootstrap must not hard-code admin_secret.
- **Remaining/future behavior:**
  - Final Cloudflare-hosted auth model.
  - Roles/permissions.
  - Secure sessions.
- **Standard fields/states:**
  - Source/provenance badge
  - Loading state
  - Unavailable state
  - Not-configured state
  - Not-observed state
  - Error details without secrets
  - Last observed timestamp when available
- **Standard prohibitions:**
  - Never fabricate a value.
  - Never infer routing authority.
  - Never enable writes without capability.
  - Never treat local evidence as Cloudflare evidence.
  - Never hide version-specific limitations.
- **Acceptance:** every displayed operational fact must resolve to an authoritative, observed, derived, read-model, or reference source category.
- **Acceptance:** empty and unavailable are not interchangeable.
- **Acceptance:** actions identify target environment and authority before execution.

## 13. Backend Phase History

### Phase 0 — Baseline

- Baseline documented in `docs/architecture/PHASE0-BASELINE-AND-BACKLOG.md`.
- Architecture copied into repository.
- Safety/migration constraints established.

### Phase 1 — Shared contracts/system

- Introduced DataProvenance concepts.
- Introduced ApiEnvelope concepts.
- Introduced structured errors.
- Introduced environment/capability/source/status concepts.
- SystemService prevents routes from calling OmniRoute adapter directly.
- Added status/capabilities/sources/environment APIs.

### Phase 2 — Catalog

- Models prefer live OmniRoute with snapshot fallback.
- Provider reads later runtime-gated to authoritative management endpoint.
- Detail/comparison/filter/sort/pagination added/reported.
- Endpoint existence alone does not enable capability.
- Snapshot enrichment must preserve provenance.

### Phase 3 — Combos/mutation contract

- Combo list/detail reads started.
- Draft validation/expected revision/structural diff/revision concepts.
- Services may return runtime-unverified.
- HTTP writes may validate then return structured 501.
- No local persistence impersonates OmniRoute writes.

### Phase 4 — Routing intelligence

- Separate telemetry/routing adapter.
- Route -> validation -> service -> adapter -> normalized domain -> envelope.
- Locally recomputed score/fallback removed/forbidden.
- 3.8.51-era Auto candidate assumption later corrected for 3.8.50.

### Phase 5 — Operations

- Authenticated monitoring health used when validated.
- Public reduced health fails closed for rich fields.
- Synthetic quota not authoritative remaining quota.
- Breaker/cooldown/lockout/combo fallback concepts kept separate.

### Phase 6 — Observability

- D1 request index/correlation.
- Nullable observed metrics only.
- OmniRoute-derived explainability separate.
- Provider attempts unavailable.
- Legacy locally scored routing_decisions not v2 truth.
- Durable routing_decision_index reported.
- Admin-only observability ingestion reported.
- Webhook ingestion intentionally not wired without emitter evidence.

## 14. Runtime 3.8.50 Reconciliation

- Earlier discovery frequently inspected 3.8.51 source.
- Actual installed runtime is 3.8.50.
- Forward-compatible code is acceptable only behind capability/version gates.
- 3.8.50 routing explainability = `/api/v1/explain/routing`.
- 3.8.50 has no assumed request-specific routing decision endpoint.
- 3.8.50 has no assumed Auto Combo candidate read endpoint.
- Combo CRUD exists but write semantics were not proven by mutating runtime configuration.
- `/api/combos/test` exists but remains disabled in product until safe semantics are proven.
- Public monitoring can be a reduced projection.
- Quota plans are metadata, not remaining quota.
- Breaker/cooldown/lockout reads are not inferred from architecture docs.
- Provider attempts remain unavailable.
- Webhook ingestion remains unavailable/unproven.
- Compatibility tests must target actual 3.8.50 behavior, not only 3.8.51-shaped mocks.

## 15. Observability Architecture

- Cloudflare/Secure-AI-Router observes edge request facts.
- OmniRoute outcomes are separate evidence.
- D1 stores durable indexes/read models.
- D1 storage does not replace original source authority.
- Explainability may be live/current and separate from persisted historical outcome.
- A trace shows missing stages rather than synthesizing them.
- Provider-attempt timelines stay unavailable until a real source exists.
- Webhook ingestion requires actual emitter evidence, not docs alone.
- Analytics Engine is a future candidate for time-series edge data.
- Logs, traces, metrics, and alerts are separate views over evidence.

### 15.1 Trace Stage Model

- Edge request accepted.
- Edge auth/rate-limit result.
- Origin forwarding attempt.
- Indexed OmniRoute outcome if available.
- Live OmniRoute explainability if available.
- Provider attempts only if verified source exists.
- Edge response completed.
- Cloudflare region/colo timing only after real deployment evidence.

## 16. Cloudflare Configuration

- **VERIFIED-CODE:** `wrangler.toml` Worker name = `omniroute-edge`.
- **VERIFIED-CODE:** Worker entry = `src/worker.ts`.
- **VERIFIED-CODE:** Compatibility date = `2026-09-12`.
- **VERIFIED-CODE:** `nodejs_compat` enabled.
- **VERIFIED-CODE:** Assets directory = `./dist`.
- **VERIFIED-CODE:** Assets binding = `ASSETS`.
- **VERIFIED-CODE:** SPA not-found handling = `single-page-application`.
- **VERIFIED-CODE:** D1 binding = `DB`.
- **VERIFIED-CODE:** D1 production name = `omniroute-edge-db`.
- **VERIFIED-CODE:** D1 production ID = all-zero placeholder.
- **VERIFIED-CODE:** Migrations directory = `drizzle`.
- **VERIFIED-CODE:** Rate-limit binding = `RATE_LIMITER`.
- **VERIFIED-CODE:** Rate-limit namespace ID in config = `2767510501` and must be verified in target account.
- **VERIFIED-CODE:** Rate limit = 60 per 60 seconds in inspected config.
- **VERIFIED-CODE:** `ENVIRONMENT = "production"` in production config.
- **VERIFIED-CODE:** `ROUTING_AUTHORITY = "omniroute"`.
- **VERIFIED-CODE:** `OMNIROUTE_ORIGIN = ""` intentionally fails closed.
- **VERIFIED-CODE:** Production origin must eventually be verified HTTPS/Tunnel.
- **VERIFIED-CODE:** Origin URL must not embed credentials.

### 16.1 Isolated Test Environment Plan

- Test Worker: `omniroute-edge-test`.
- Test D1: `omniroute-edge-test-db`.
- Test config: separate `wrangler.test.toml` or equivalent.
- Do not modify production `wrangler.toml` during test deployment.
- Do not expose `localhost:20128` directly to Cloudflare.
- Without secure origin, OmniRoute-dependent routes must fail closed/unavailable.
- UI/assets/system routes can still be verified on Cloudflare.
- No production custom domain, route, D1, secrets, or Tunnel changes during the isolated test.

## 17. Geographic / Edge Verification Rules

- Localhost and Cloudflare are different network environments.
- Cloudflare may terminate in a geographically different colo.
- Local latency does not predict edge-to-origin latency.
- Provider reachability may differ.
- DNS resolution may differ.
- IPv4/IPv6 path selection may differ.
- Cloudflare headers may alter observable behavior.
- Edge rate limiting differs from localhost.
- Caching behavior may differ.
- Static asset serving differs from Vite/local serving.
- Worker runtime constraints differ from Node on Windows.
- D1 latency differs from local SQLite.
- Provider APIs can behave geo-sensitively.
- Origin TLS/Tunnel does not exist in direct localhost calls.
- Cloudflare request IDs/colo are edge-only evidence.
- Final verification must capture at least one real Cloudflare end-to-end request.
- Geo evidence should record colo/region when available.
- Cloudflare evidence must not be backfilled into older local traces.
- Local compatibility remains valuable but is not deployment proof.

## 18. Authentication and Secret Boundaries

- OmniRoute management auth is separate from Secure-AI-Router product auth.
- Browser admin auth must not fall back to a hard-coded default secret.
- Local DB bootstrap must not hard-code `admin_secret`.
- Provider credentials must never be printed.
- `.env` must not ship in distributable artifacts.
- Cloudflare secrets should use secure bindings/secrets, not committed plaintext.
- Cloudflare-to-origin authentication needs explicit design before production.
- Public inference must not remain open on broad interface without authentication.
- Operator auth and OmniRoute management password remain separate trust domains.
- Admin ingestion endpoints remain admin-only.

## 19. Current Verification Snapshot

- **VERIFIED-LOCAL:** `npm run lint` — PASS.
- **VERIFIED-LOCAL:** `npm test` — PASS, 41/41.
- **VERIFIED-LOCAL:** `npm run verify:data` — PASS.
- **VERIFIED-LOCAL:** `npm run build` — PASS.
- **VERIFIED-LOCAL:** `npm run test:node` — 44 PASS / 1 FAIL.
- **VERIFIED-LOCAL:** The Node-suite failure is static-safety/package-artifact related.
- **VERIFIED-LOCAL:** The project is stable for handoff but not release-verified.

### 19.1 Static-Safety Failure Inventory

- **BLOCKED:** `.env` flagged as forbidden runtime artifact.
- **BLOCKED:** `data/providers-and-keys.json` flagged as forbidden credential/runtime dump.
- **BLOCKED:** `scratch_omniroute_raw.json` flagged as forbidden credential/runtime dump.
- **BLOCKED:** Multiple `_qa/ui/...` Chrome database artifacts flagged.
- **BLOCKED:** `node_modules/` flagged as forbidden packaged directory.
- **BLOCKED:** `dist/` flagged under strict package-safety mode.
- **BLOCKED:** `.wrangler/` flagged as forbidden packaged directory.
- **BLOCKED:** API secret pattern detected in `data/providers-and-keys.json`.
- **BLOCKED:** API secret pattern detected in `scratch_omniroute_raw.json`.
- **BLOCKED:** API secret pattern detected in `scripts/migrate-omniroute.mjs`.
- **BLOCKED:** `src/server/router.ts` flagged as retired local routing/security module restored.
- **BLOCKED:** `src/server/health.ts` flagged as retired local routing/security module restored.
- **BLOCKED:** `src/server/policy.ts` flagged as retired local routing/security module restored.
- **BLOCKED:** `src/server/firewall.ts` flagged as retired local routing/security module restored.

## 20. Local Data Verification Snapshot

- **VERIFIED-LOCAL:** 26 providers.
- **VERIFIED-LOCAL:** 433 models.
- **VERIFIED-LOCAL:** 6 API keys in local inventory summary.
- **VERIFIED-LOCAL:** 2 observed requests.
- **VERIFIED-LOCAL:** 1 security event.
- **VERIFIED-LOCAL:** Matching provider/model/key inventory IDs across both local databases.
- **VERIFIED-LOCAL:** Integrity and foreign-key checks passed.
- **VERIFIED-LOCAL:** Upgraded request telemetry schema present.
- **VERIFIED-LOCAL:** 6 provider connections had no model rows and no rows were fabricated.
- **VERIFIED-LOCAL:** These are local data facts, not Cloudflare production facts.

## 21. Secure-AI-Router API Map

- `/api/v2/system/status` — normalized system status.
- `/api/v2/system/capabilities` — capability contract.
- `/api/v2/system/sources` — source/provenance inventory.
- `/api/v2/system/environment` — environment identity.
- `/api/v2/models` — normalized model catalog.
- `/api/v2/providers` — normalized provider catalog.
- Provider/model detail, comparison, filtering, sorting, pagination were added/reported.
- Combo list/detail reads were introduced/reported.
- Combo write routes can remain structured unavailable/501.
- Routing intelligence is covered under `/api/v2/routing` tests.
- `POST /api/v2/observability/ingest/omniroute` reported as admin-only ingestion.
- `GET /api/v2/observability/routing-decisions` reported for durable outcome index.
- Exact public API inventory should be regenerated from source before final external API documentation.

## 22. Relevant OmniRoute API Map

- `/v1/*` — OpenAI-compatible inference.
- `/v1/models` — model surface used in early integration.
- `/api/providers` — provider management read.
- `/api/v1/explain/routing` — 3.8.50 routing explainability.
- `/api/monitoring/health` — monitoring health.
- `/api/health` — general health.
- `/api/memory/health` — memory health.
- `/api/settings/qdrant/health` — Qdrant health.
- `/api/usage/cache-health` — usage cache health.
- `/api/storage/health` — storage health.
- `/api/token-health` — token health.
- `/api/quota/pools` — pool collection.
- `/api/quota/pools/{id}` — pool detail/update/delete.
- `/api/quota/pools/{id}/usage` — pool usage.
- `/api/quota/plans` — plan metadata.
- `/api/quota/plans/{connectionId}` — plan detail/update/delete.
- `/api/quota/preview` — preview.
- `/api/settings/quota-store` — quota-store settings.
- `/api/combos/test` — Combo test.
- Combo CRUD — present in contract.
- `POST /api/resilience/reset` — resilience reset.
- `POST /api/settings/require-login` — login requirement/password config.
- `POST /api/auth/login` — management login.
- `POST /api/auth/logout` — logout.
- `GET /api/auth/status` — auth status.
- `POST /api/cli/connect` — management password -> scoped CLI token according to inspected summary.

## 23. Capability Gating Rules

- Endpoint existence does not equal working capability.
- Authenticated access is required when endpoint requires auth.
- Schema must validate.
- Semantics must match the domain contract.
- Write capability requires stronger evidence than read capability.
- A documented endpoint may remain disabled if runtime semantics are unproven.
- Reduced health must not enable rich health.
- Future-version endpoints may remain coded but disabled.
- Snapshot fallback may satisfy reference UI but not live capability.
- Provider attempts stay unavailable.
- Webhook stays disabled until emitters are proven.
- Cloudflare-specific capabilities stay unverified until actual deployment.

## 24. Known Not-Implemented / Blocked Work

- **NOT-IMPLEMENTED/BLOCKED:** Full production Cloudflare deployment.
- **NOT-IMPLEMENTED/BLOCKED:** Production D1 with real ID.
- **NOT-IMPLEMENTED/BLOCKED:** Verified HTTPS/Tunnel origin.
- **NOT-IMPLEMENTED/BLOCKED:** Origin authentication.
- **NOT-IMPLEMENTED/BLOCKED:** Custom domain/final production route.
- **NOT-IMPLEMENTED/BLOCKED:** Geographically representative edge verification.
- **NOT-IMPLEMENTED/BLOCKED:** Cloudflare production telemetry/colo evidence.
- **NOT-IMPLEMENTED/BLOCKED:** Analytics Engine time-series integration.
- **NOT-IMPLEMENTED/BLOCKED:** Provider-attempt ingestion.
- **NOT-IMPLEMENTED/BLOCKED:** Webhook ingestion from proven emitters.
- **NOT-IMPLEMENTED/BLOCKED:** Verified Combo mutation semantics.
- **NOT-IMPLEMENTED/BLOCKED:** Verified Combo test semantics.
- **NOT-IMPLEMENTED/BLOCKED:** Version-gated future 3.8.51+ richer explainability.
- **NOT-IMPLEMENTED/BLOCKED:** Authoritative remaining-quota display if no source exists.
- **NOT-IMPLEMENTED/BLOCKED:** Breaker/cooldown/lockout read UI without real endpoints.
- **NOT-IMPLEMENTED/BLOCKED:** Field-level provenance across every screen.
- **NOT-IMPLEMENTED/BLOCKED:** Cloudflare deployment/status page.
- **NOT-IMPLEMENTED/BLOCKED:** Final product auth strategy.
- **NOT-IMPLEMENTED/BLOCKED:** Final secret/origin hardening.
- **NOT-IMPLEMENTED/BLOCKED:** Node runtime upgrade.
- **NOT-IMPLEMENTED/BLOCKED:** OmniRoute bind/API-key hardening.
- **NOT-IMPLEMENTED/BLOCKED:** Static-safety cleanup.
- **NOT-IMPLEMENTED/BLOCKED:** Release artifact cleanup.
- **NOT-IMPLEMENTED/BLOCKED:** Retired local routing/security module disposition.
- **NOT-IMPLEMENTED/BLOCKED:** Final release verification.
- **NOT-IMPLEMENTED/BLOCKED:** Final visual polish against 1368×753 reference.
- **NOT-IMPLEMENTED/BLOCKED:** Full local-vs-Cloudflare behavior matrix.
- **NOT-IMPLEMENTED/BLOCKED:** End-to-end safe provider/Combo management workflows.
- **NOT-IMPLEMENTED/BLOCKED:** Production rollback plan.
- **NOT-IMPLEMENTED/BLOCKED:** Production alert delivery integrations.

## 25. Detailed Roadmap

### Stage A — 3.8.50 compatibility closure

- Ensure no request-specific decision call on 3.8.50.
- Ensure no Auto-candidate call on 3.8.50.
- Use `/api/v1/explain/routing` as snapshot explainability.
- Fail closed on reduced public health.
- Treat quota plans as metadata.
- Re-run focused/full tests, lint, build.

### Stage B — Release safety

- Remove/quarantine release-forbidden artifacts.
- Resolve secret-pattern findings.
- Resolve retired local routing/security modules.
- Re-run static safety and Node suite.

### Stage C — Isolated Cloudflare test

- Authenticate Wrangler.
- Create `omniroute-edge-test-db`.
- Create separate test config.
- Deploy `omniroute-edge-test`.
- Verify UI/assets/system routes.
- Keep origin-dependent behavior unavailable until secure origin exists.

### Stage D — Secure origin

- Upgrade Node.
- Harden OmniRoute bind/API-key posture.
- Choose Cloudflare Tunnel or verified HTTPS origin.
- Add origin authentication.
- Verify Cloudflare-to-origin connectivity.

### Stage E — Edge integration verification

- Run catalog/system/routing/observability through Cloudflare.
- Record colo/region.
- Compare local and edge results.
- Validate D1/rate-limit.
- Validate streaming/errors/timeouts.

### Stage F — Product UI completion

- Finish field-level provenance.
- Add Cloudflare deployment/region status.
- Add capability-aware safe writes.
- Polish against visual reference.
- Complete operator workflows.

### Stage G — Production readiness

- Create/verify production D1.
- Apply migrations.
- Set secure production origin.
- Configure secrets.
- Verify rate-limit namespace.
- Deploy exact candidate.
- Run production E2E.
- Only then call production-verified.

## 26. UI State Semantics

### Known / observed

- Display value.
- Show provenance.
- Show observed timestamp when available.
- Do not overstate freshness.

### Unknown

- Render Unknown/—.
- Do not render zero.
- Do not infer.
- Explain source gap.

### Unavailable

- Say source/API unavailable.
- Do not present “no records”.
- Disable dependent actions.

### Not configured

- Say Not configured.
- Offer setup only if supported/authorized.

### Not observed

- Say Not observed.
- Do not convert to false/zero.
- Use for attempts/usage/cost/timing gaps.

### OmniRoute-derived

- Label as OmniRoute-derived.
- Do not relabel as edge observation.
- Do not recompute locally.

### Snapshot/reference

- Label non-authoritative.
- Show freshness if known.
- Use field-level provenance when mixed.

### Blocked/unverified capability

- Disable action.
- Explain reason.
- Do not create fake local workaround.

## 27. UI Interaction Contract

- Every enabled button maps to a real backend capability.
- Every mutation validates before execution.
- Every destructive mutation requires explicit confirmation.
- Every version-sensitive mutation is capability-gated.
- Optimistic UI never claims success before authoritative confirmation.
- Failed writes do not leave desired state shown as actual.
- Filters must actually work.
- Search must actually work.
- Pagination must represent real dataset paging.
- Exports must match their labels.
- Provenance affordances explain authority/freshness.
- Advanced OmniRoute links are restricted.
- Cloudflare deployment actions remain separate from routing config.

## 28. Product Navigation Map

- **Overview:** System/edge/runtime status and recent activity.
- **Providers:** Provider inventory and safe management.
- **Models:** Model catalog/comparison.
- **Combos:** Combo list/detail and future safe management.
- **Routing:** OmniRoute explainability.
- **Requests:** Observed logs.
- **Traces:** Correlated timelines.
- **Metrics:** Observed metrics.
- **Alerts:** Operational alerts.
- **Topology:** Read-only architecture/connectivity.
- **System:** Capabilities/sources/environment/compatibility.
- **Cloudflare:** Deployment/D1/edge/region/origin status.
- **Settings:** Product and safe proxied settings.
- **Advanced / OmniRoute Admin:** Controlled deep link to engine admin.

## 29. Dashboard Card Model

- **Edge status:** source = Cloudflare. Only after deployed evidence.
- **OmniRoute runtime:** source = OmniRoute health. Separate from edge status.
- **Providers:** source = Live management or snapshot. Show live/reference mode.
- **Models:** source = Live or snapshot. Show source.
- **Recent requests:** source = Observed edge requests. No invented provider/model.
- **Routing explainability:** source = OmniRoute-derived. Snapshot/current semantics.
- **D1 read model:** source = Cloudflare D1. Not routing authority.
- **Alerts:** source = Observed signals. Unavailable != empty.
- **Security posture:** source = runtime/deployment checks. Warn on insecure bind/version.
- **Deployment identity:** source = Cloudflare. Only when observed.

## 30. Provider Detail Specification

- Provider display name and stable ID.
- Source badge.
- Enabled state if authoritative.
- Connection identity without secrets.
- Health only from validated source.
- Model count with source.
- Observed recent requests if correlated.
- Observed error rate only with real metric source.
- Quota plan metadata separated from remaining quota.
- Cloudflare reachability separated from provider health.
- Never display credentials.
- Test action disabled until verified.
- Edit action disabled until verified.
- Audit/history only if real records exist.

## 31. Model Detail Specification

- Model ID.
- Provider association if authoritative.
- Live/reference provenance.
- Capabilities only when sourced.
- Context/token limits only when sourced.
- Price/cost only when sourced/freshness known.
- Observed usage when available.
- No inferred health.
- No local winner score.
- Normalized comparison.
- Explainability references only when OmniRoute provides them.

## 32. Combo Detail Specification

- Combo identity/revision if provided.
- Configuration structure exactly as OmniRoute defines it.
- Provider/model members with source.
- Read-only by default.
- Draft validation.
- Structural diff.
- Expected revision.
- Apply disabled while unverified.
- Test disabled while unverified.
- No locally simulated routing outcome.

## 33. Routing Explainability Specification

- Current explainability timestamp if returned.
- Label 3.8.50 as snapshot/current routing surface.
- Candidates/factors only if returned.
- Scores labeled OmniRoute-derived.
- No historical-request claim without source linkage.
- Observed request outcome shown separately.
- Request-specific decision marked unavailable on 3.8.50.
- Future richer behavior capability-gated.

## 34. Trace Detail Specification

- **Edge Request:**
  - request ID
  - timestamp
  - method/path
  - status
  - edge timing
  - colo/region when deployed
- **Origin Forwarding:**
  - origin target without secrets
  - outcome
  - network/HTTP error
  - timing if observed
- **OmniRoute Outcome:**
  - provider/model if observed
  - outcome status
  - source event ID
- **Routing Explainability:**
  - OmniRoute-derived factors
  - snapshot timestamp
  - non-request-specific label where applicable
- **Provider Attempts:**
  - Unavailable until real source exists.
- **Persistence:**
  - D1 index/correlation status
  - read-model timestamp

## 35. Metrics Taxonomy

- **Edge request count:** observed edge requests
- **Edge error count:** observed responses
- **Edge latency:** edge measurement
- **Origin latency:** only if instrumented
- **OmniRoute outcome counts:** persisted runtime outcomes
- **Provider/model distribution:** observed outcomes only
- **Token usage:** nullable source-backed
- **Cost:** nullable source-backed
- **Routing score:** OmniRoute-derived, not edge metric
- **Quota plan limits:** configuration metadata
- **Region/colo distribution:** Cloudflare-only

## 36. Alert Taxonomy

- Worker unavailable.
- OmniRoute origin unreachable from Cloudflare.
- Authenticated management unavailable.
- Validated runtime health degraded.
- D1 unavailable/migration mismatch.
- Rate limiter misconfigured.
- Origin missing.
- Node runtime below secure minimum.
- Runtime broadly exposed without required inference auth.
- Observed provider errors.
- Authoritative quota alert if source exists.
- Alert-source API unavailable as a distinct state.

## 37. Cloudflare Test Acceptance

- CF-001: Wrangler auth succeeds.
- CF-002: Isolated test D1 created.
- CF-003: Test migrations apply.
- CF-004: Isolated Worker deploys.
- CF-005: Root UI loads.
- CF-006: CSS loads.
- CF-007: JS loads.
- CF-008: SPA routes work.
- CF-009: System status responds.
- CF-010: Capabilities responds.
- CF-011: Sources responds.
- CF-012: Environment responds.
- CF-013: Origin-dependent routes fail closed when origin unset.
- CF-014: No fabricated data.
- CF-015: Rate-limit binding valid.
- CF-016: Cloudflare request ID captured.
- CF-017: Colo/region captured if available.
- CF-018: No secrets in logs.
- CF-019: Worker URL recorded.
- CF-020: D1 ID recorded.
- CF-021: No production resource changed.

## 38. Secure Origin Acceptance

- ORIGIN-001: HTTPS or secure Tunnel.
- ORIGIN-002: Not raw unauthenticated 0.0.0.0 exposure.
- ORIGIN-003: Inference auth on untrusted exposure.
- ORIGIN-004: Cloudflare-to-origin auth.
- ORIGIN-005: Management auth preserved.
- ORIGIN-006: No embedded credentials in URL.
- ORIGIN-007: Worker can reach origin.
- ORIGIN-008: Health probes reveal no secrets.
- ORIGIN-009: Fail closed on origin failure.
- ORIGIN-010: Recovery path preserved.

## 39. Production Release Gates

- RELEASE-001: Exact source candidate identified.
- RELEASE-002: Lint PASS.
- RELEASE-003: Vitest PASS.
- RELEASE-004: Node suite PASS for release profile.
- RELEASE-005: Static safety PASS.
- RELEASE-006: Build PASS.
- RELEASE-007: Production D1 verified.
- RELEASE-008: Migrations verified.
- RELEASE-009: Worker config verified.
- RELEASE-010: Origin HTTPS/Tunnel verified.
- RELEASE-011: Origin auth verified.
- RELEASE-012: OmniRoute version recorded.
- RELEASE-013: Node patched/supported.
- RELEASE-014: Inference exposure hardened.
- RELEASE-015: Test deployment verified.
- RELEASE-016: Production deploy version recorded.
- RELEASE-017: UI/API smoke tests pass.
- RELEASE-018: Cloudflare colo evidence captured.
- RELEASE-019: Catalog verified.
- RELEASE-020: Explainability verified.
- RELEASE-021: Observability/D1 correlation verified.
- RELEASE-022: No fabricated UI data.
- RELEASE-023: Rollback known.
- RELEASE-024: Only then call production-verified.

## 40. Things the Project Must Never Do

- NEVER-001: Build a second provider-selection engine.
- NEVER-002: Let Worker independently choose fallback provider.
- NEVER-003: Let React choose execution provider/model.
- NEVER-004: Let D1 become routing authority.
- NEVER-005: Present snapshot health as live.
- NEVER-006: Present plan limit as remaining quota.
- NEVER-007: Manufacture provider attempts.
- NEVER-008: Manufacture routing score.
- NEVER-009: Manufacture alert timestamp.
- NEVER-010: Manufacture operator identity.
- NEVER-011: Manufacture deployment identity.
- NEVER-012: Treat endpoint existence as capability.
- NEVER-013: Expose secrets.
- NEVER-014: Deploy production merely to test uncertainty.
- NEVER-015: Treat localhost as proof of Cloudflare.
- NEVER-016: Treat Cloudflare as proof of local.
- NEVER-017: Weaken auth to make tests pass.
- NEVER-018: Create fake data to populate UI.
- NEVER-019: Create providers/Combos/quota pools only to probe semantics.
- NEVER-020: Remove tests to get green.
- NEVER-021: Call blocked/unverified a pass.
- NEVER-022: Use visual reference as operational truth.
- NEVER-023: Expose OmniRoute admin publicly by default.

## 41. Handoff Rules for the Next Agent

- Initialize Desktop Commander/MCP access only; do not begin with broad repository exploration.
- Use exact canonical project root.
- Confirm filesystem/terminal access minimally.
- Do not use reconstructed copy.
- Do not touch GitHub unless asked.
- Do not mutate production Cloudflare without approval.
- Do not print secrets/full env.
- Inspect only bounded files needed.
- Distinguish OmniRoute 3.8.50 from 3.8.51 reference assumptions.
- Preserve forward compatibility behind gates.
- Use focused tests for compatibility changes.
- Run proportional verification.
- Stop at requested stable checkpoint.
- Report actual changed files/commands/results.
- Record Cloudflare and local evidence separately.

## 42. Important Source Modules / Test Areas

- `src/domain/platform.ts`.
- `src/integrations/omniroute/telemetryAdapter.ts`.
- OmniRoute management adapter(s).
- `src/services/capabilityService.ts`.
- `src/services/observabilityService.ts`.
- `src/services/telemetryIngestionService.ts`.
- System service.
- Routing intelligence service.
- `src/repositories/requestReadModelRepository.ts`.
- `src/repositories/routingDecisionIndexRepository.ts`.
- `src/api/v2/observability.ts`.
- `src/server/db/schema.ts`.
- `src/server/db/node.ts`.
- `src/server/app.ts`.
- `src/worker.ts`.
- `drizzle/0004_routing_decision_index.sql` reported.
- `src/server/__tests__/api-v2-observability.test.ts`.
- `src/server/__tests__/api-v2-routing.test.ts`.
- `src/server/__tests__/api-v2-catalog.test.ts`.
- `src/server/__tests__/api-v2-system.test.ts`.
- `src/server/__tests__/api-v2-combos.test.ts`.
- `src/server/__tests__/api-v2-operations.test.ts`.
- `test-node/*.test.mjs`.

## 43. Storage / Migration Principles

- D1 stores edge/read-model data.
- SQLite may hold existing provider/model/key inventory and telemetry.
- Preserve existing DBs unless deliberate migration.
- Migrations are explicit/repeatable.
- Test D1 and prod D1 are distinct.
- Migration target identity must be verified.
- Do not relabel snapshot data as live via migration.
- Do not promote historical locally scored decisions to authoritative v2 outcomes.
- Preserve original event/source IDs.
- Nullable telemetry stays nullable.

## 44. Data Contract Rules

- Use stable domain types.
- Validate source schemas at adapters.
- Use structured errors.
- Return provenance.
- Return capability context on unavailable results.
- Do not overload null/zero/false/empty.
- Preserve source timestamps.
- Preserve request/correlation IDs.
- Preserve version info when observed.
- Preserve read/write distinctions.
- Normalize naming without erasing IDs.

## 45. Version Compatibility Policy

- Actual runtime beats different-version docs.
- 3.8.50 is current baseline.
- 3.8.51 source informs future support only.
- Prefer capability/schema detection where practical.
- Read-only probing may be used safely.
- Writes require explicit runtime verification.
- Absent endpoints return structured unavailable.
- Future endpoints may stay behind disabled gates.
- UI should disclose version limitations.

## 46. Windows Development Notes

- Primary dev host is Windows.
- Node observed = 22.22.0.
- OmniRoute secure minimum warning = 22.22.2+ on 22.x.
- NVM for Windows available.
- Launch OmniRoute from `C:\project\OmniRoute-Runtime`.
- Do not launch OmniRoute from Secure-AI-Router root because it can load project env/config.
- Global npm cache was previously affected by another project; isolated cache/prefix was used.
- Do not casually change the other project npm cache config.
- Run Wrangler from canonical project root.

## 47. Product vs Engine UI Decision Table

- **Overall edge + engine status:** Secure-AI-Router UI.
- **Request logs/traces:** Secure-AI-Router UI.
- **Cloudflare region/colo:** Secure-AI-Router UI.
- **Provider/model comparison:** Secure-AI-Router UI.
- **Normalized explainability:** Secure-AI-Router UI.
- **First-time OmniRoute bootstrap:** OmniRoute UI.
- **Direct provider credentials:** OmniRoute UI until safe product write contract exists.
- **Engine recovery:** OmniRoute UI/CLI.
- **Native advanced settings:** OmniRoute UI.
- **Deploy Worker/D1:** Cloudflare/Wrangler workflow.
- **Change production origin:** Cloudflare deployment workflow.

## 48. End-to-End Normal Request Simulation

- 01. Client sends OpenAI-compatible request to Cloudflare-hosted endpoint.
- 02. Worker authenticates/rate-limits.
- 03. Worker forwards through configured origin path.
- 04. OmniRoute receives execution request.
- 05. OmniRoute selects provider/model.
- 06. OmniRoute performs retry/fallback if needed.
- 07. Response returns through control plane to edge.
- 08. Edge facts are observed/persisted.
- 09. OmniRoute outcome is correlated when available.
- 10. UI shows actual outcome without reconstructing missing internals.
- 11. Explainability is labeled OmniRoute-derived.
- 12. Colo/region is shown only from actual Cloudflare evidence.

## 49. Failure Simulation: OmniRoute Unavailable

- UI/assets may still load from Cloudflare.
- System source reports OmniRoute unavailable.
- Catalog may fall back to reference where allowed.
- Live provider health is not faked.
- Explainability unavailable.
- Execution fails according to fail-closed design; edge does not choose fallback provider.
- UI shows origin/runtime incident rather than fake “0 healthy”.
- Alerts may report source outage if real signal exists.

## 50. Failure Simulation: Cloudflare Path Differs from Local

- Local probe succeeds.
- Cloudflare-to-origin probe fails.
- UI displays local runtime evidence and Cloudflare origin reachability separately.
- Do not conclude runtime is down solely from edge reachability.
- Do not mark edge path healthy solely from local reachability.
- Diagnosis identifies failing boundary: edge, origin path, runtime, provider, or data store.

## 51. Partial-Health Simulation

- Public health returns only status/setupComplete.
- Adapter validates missing rich fields.
- Capability service keeps rich health disabled.
- UI displays only returned fields.
- Provider health remains Unknown/Unavailable.
- Authenticated rich health can enable more fields after validation.

## 52. Quota Simulation

- Plan metadata may be shown.
- Do not show remaining percentage without authoritative evidence.
- Pool usage can be shown when source semantics are understood.
- Any future derived pressure signal must be labeled derived.

## 53. Combo Write Simulation Before Verification

- UI may validate a draft.
- UI may show structural diff.
- Backend returns runtime-unverified for apply.
- UI does not mutate displayed live state.
- UI explains version/runtime limitation.
- Authorized operator may use native OmniRoute UI if necessary.

## 54. Future OmniRoute Version Simulation

- Capability detection sees richer endpoint.
- Adapter validates schema.
- Capability service enables feature.
- 3.8.50 fallback remains intact.
- UI conditionally exposes richer explainability/candidates.
- No destructive rewrite required.

## 55. Accessibility Requirements

- Keyboard navigation.
- Visible focus.
- Accessible labels for icon controls.
- Color not sole health indicator.
- Text for unknown/unavailable.
- Readable table headers.
- Copyable IDs.
- Timezone-aware timestamps.
- Redacted errors.
- Confirmations identify target/environment.
- Test vs prod visually obvious.

## 56. Performance Requirements

- Dashboard does not wait for every secondary API.
- Panels fail independently.
- Large logs/traces are paged/bounded.
- Catalogs use real pagination.
- Refresh respects rate limits.
- Refresh interval does not imply false liveness.
- Do not cache sensitive operator responses incorrectly.
- Expensive topology/metrics queries are bounded/lazy.

## 57. UI Security Requirements

- Never render provider API keys.
- Never render Cloudflare secrets.
- Never place secrets in browser build-time public variables.
- Do not store management passwords in plaintext localStorage.
- Do not echo secrets after form submission.
- Redact upstream credential material from browser errors.
- Expire/refresh sessions appropriately.
- Identify environment on mutations.
- Restrict advanced engine links.

## 58. Documentation Needed Before Production

- Architecture overview.
- Local development runbook.
- OmniRoute startup/hardening runbook.
- Cloudflare test deploy runbook.
- Cloudflare production deploy runbook.
- D1 migration runbook.
- Origin/Tunnel runbook.
- Authentication/secret runbook.
- Rollback runbook.
- Incident boundary guide.
- Version compatibility matrix.
- Known-unavailable capability list.
- UI provenance vocabulary.
- Release verification checklist.

## 59. Current Package Script Map

- `npm run dev` — Vite dev server.
- `npm run dev:server` — tsx local server.
- `npm run build` — Vite production build.
- `npm run start` — tsx local server.
- `npm run cf:deploy` — Wrangler deploy default config.
- `npm run cf:d1:create` — create production-named D1.
- `npm run cf:d1:migrate` — remote D1 migrations.
- `npm run cf:d1:migrate:local` — local D1 migrations.
- `npm run preview` — Vite preview.
- `npm run lint` — tsc --noEmit.
- `npm run test` — Vitest.
- `npm run test:node` — Node test suite.
- `npm run verify:safety` — static safety verifier.
- `npm run verify:deploy-config` — fail-closed deploy config verifier.
- `npm run verify:release` — composite release verifier.
- `npm run verify:data` — local data verifier.

## 60. Deploy Config Verification Rules

- D1 ID cannot be empty/all-zero.
- OMNIROUTE_ORIGIN required for production.
- Origin must be HTTPS.
- Origin must not embed credentials.
- Production ENVIRONMENT must be production.
- ROUTING_AUTHORITY remains omniroute.
- Verifier fails closed.
- Test environment should use separate config/verification, not weaken production verifier.

## 61. Why Secure-AI-Router UI Must Remain Separate

- Product needs Cloudflare-specific information.
- Product needs cross-source provenance.
- Product needs D1 views.
- Product needs edge logs/traces.
- Product needs deployment/region awareness.
- Product needs stable UX independent of OmniRoute internal UI changes.
- Product needs controlled safe management exposure.
- Product can show reference data truthfully when engine offline.
- Product can unify edge/runtime without changing routing authority.
- OmniRoute UI remains valuable for engine-native admin.
- Merging the UIs conceptually would blur trust boundaries.

## 62. Why Secure-AI-Router Must Not Replace OmniRoute

- Routing belongs to OmniRoute.
- Fallback belongs to OmniRoute.
- Combo semantics belong to OmniRoute.
- Native credentials/config belong to OmniRoute unless proxied safely.
- Two routing authorities create conflicting truth.
- Edge fallback violates architecture.
- D1 route selection violates architecture.
- React route selection violates architecture.
- Secure-AI-Router observes, normalizes, orchestrates, and safely manages; it does not duplicate engine.

## 63. Cloudflare UI Concepts to Add

- Worker deployment identity.
- Environment badge.
- workers.dev/custom domain URL.
- D1 identity.
- Migration state.
- Rate limiter status.
- Origin/Tunnel status.
- Origin reachability from edge.
- Recent request colo.
- Region distribution.
- Edge vs origin latency.
- Worker error rate.
- Cloudflare request IDs.
- Cache behavior if used.
- Analytics Engine status if added.
- Deployment security warnings.

## 64. OmniRoute Concepts to Mirror Selectively

- Provider inventory.
- Model inventory.
- Combo inventory.
- Routing explainability.
- Runtime health summary.
- Quota plan metadata.
- Quota pool usage when authoritative.
- Provider test only after verification.
- Combo mutations only after verification.
- Advanced settings may remain engine-only.
- Credential management remains tightly controlled.

## 65. Provenance Badge Vocabulary

- `LIVE · OMNIROUTE`
- `OBSERVED · EDGE`
- `DERIVED · OMNIROUTE`
- `READ MODEL · D1`
- `REFERENCE · LOCAL SNAPSHOT`
- `UNAVAILABLE`
- `NOT OBSERVED`
- `NOT CONFIGURED`
- `LOCAL VERIFIED`
- `CLOUDFLARE VERIFIED`

## 66. Status Vocabulary

- **Healthy:** Only when validated source says healthy.
- **Degraded:** Only when validated source supports degradation.
- **Unavailable:** Source/capability cannot be reached.
- **Unknown:** Insufficient evidence.
- **Not configured:** Required config absent.
- **Not observed:** Event/value not captured.
- **Reference only:** Snapshot/non-authoritative.
- **Blocked:** Operation intentionally disabled pending verification.

## 67. Open Questions Requiring Future Evidence

- **OPEN:** Exact authenticated full-health schema in configured 3.8.50 environment?
- **OPEN:** Exact revision/concurrency semantics for Combo writes?
- **OPEN:** Is `/api/combos/test` non-persistent and automation-safe?
- **OPEN:** Best secure origin topology?
- **OPEN:** Best Cloudflare-to-Origin auth?
- **OPEN:** Which production account/zone/domain?
- **OPEN:** Analytics Engine or D1 for initial time series?
- **OPEN:** Authoritative provider-attempt source?
- **OPEN:** Will future OmniRoute expose request-specific decisions?
- **OPEN:** D1 retention policy?
- **OPEN:** Final multi-user operator auth model?
- **OPEN:** Which advanced engine settings remain engine-only?
- **OPEN:** Production SLOs once real metrics exist?

## 68. Detailed Domain Implementation Checklist

### System API

- REQ-0001: Implement/preserve `environment identity` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0002: Implement/preserve `runtime identity` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0003: Implement/preserve `source inventory` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0004: Implement/preserve `capability flags` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0005: Implement/preserve `unavailable behavior` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0006: Implement/preserve `structured errors` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0007: Implement/preserve `provenance` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0008: Implement/preserve `observed version only` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0009: Implement/preserve `future Cloudflare identity` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0010: Implement/preserve `future security warnings` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Provider Catalog

- REQ-0011: Implement/preserve `live authenticated read` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0012: Implement/preserve `schema validation` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0013: Implement/preserve `snapshot fallback` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0014: Implement/preserve `non-authoritative label` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0015: Implement/preserve `no snapshot health merge` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0016: Implement/preserve `detail` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0017: Implement/preserve `pagination` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0018: Implement/preserve `sorting` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0019: Implement/preserve `filtering` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0020: Implement/preserve `safe writes later` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Model Catalog

- REQ-0021: Implement/preserve `live read` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0022: Implement/preserve `schema validation` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0023: Implement/preserve `source IDs` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0024: Implement/preserve `comparison` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0025: Implement/preserve `filtering` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0026: Implement/preserve `sorting` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0027: Implement/preserve `pagination` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0028: Implement/preserve `no fabricated pricing` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0029: Implement/preserve `field provenance` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0030: Implement/preserve `source freshness` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Combos

- REQ-0031: Implement/preserve `list` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0032: Implement/preserve `detail` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0033: Implement/preserve `draft validation` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0034: Implement/preserve `structural diff` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0035: Implement/preserve `expected revision` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0036: Implement/preserve `apply disabled` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0037: Implement/preserve `test disabled` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0038: Implement/preserve `no local simulation` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0039: Implement/preserve `audit later` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0040: Implement/preserve `rollback later` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Routing Intelligence

- REQ-0041: Implement/preserve `3.8.50 explain path` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0042: Implement/preserve `snapshot semantics` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0043: Implement/preserve `normalize OmniRoute factors` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0044: Implement/preserve `disable request-specific call` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0045: Implement/preserve `disable Auto candidates` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0046: Implement/preserve `future version gate` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0047: Implement/preserve `separate outcome/explainability` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0048: Implement/preserve `source label` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0049: Implement/preserve `offline behavior` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0050: Implement/preserve `version tests` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Health

- REQ-0051: Implement/preserve `authenticated health` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0052: Implement/preserve `schema validation` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0053: Implement/preserve `reduced public shape` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0054: Implement/preserve `no promoted generic health` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0055: Implement/preserve `source-level separation` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0056: Implement/preserve `unavailable state` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0057: Implement/preserve `future Cloudflare origin health` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0058: Implement/preserve `D1 health` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0059: Implement/preserve `version warning` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0060: Implement/preserve `bind/API-key warning` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Quota

- REQ-0061: Implement/preserve `plan metadata` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0062: Implement/preserve `pool metadata` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0063: Implement/preserve `pool usage` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0064: Implement/preserve `no remaining claim` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0065: Implement/preserve `no fabrication` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0066: Implement/preserve `preview separate` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0067: Implement/preserve `quota-store separate` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0068: Implement/preserve `derived label` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0069: Implement/preserve `UI copy` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0070: Implement/preserve `version tests` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Observability

- REQ-0071: Implement/preserve `edge facts` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0072: Implement/preserve `nullable token/cost` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0073: Implement/preserve `OmniRoute outcome index` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0074: Implement/preserve `preserve original authority` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0075: Implement/preserve `correlation` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0076: Implement/preserve `separate explainability` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0077: Implement/preserve `attempts unavailable` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0078: Implement/preserve `webhooks disabled` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0079: Implement/preserve `Analytics Engine plan` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0080: Implement/preserve `future colo/region` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Cloudflare

- REQ-0081: Implement/preserve `test Worker` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0082: Implement/preserve `test D1` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0083: Implement/preserve `migrations` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0084: Implement/preserve `deploy UI/assets` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0085: Implement/preserve `system routes` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0086: Implement/preserve `fail-closed origin` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0087: Implement/preserve `secure origin` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0088: Implement/preserve `verify D1` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0089: Implement/preserve `verify rate limit` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0090: Implement/preserve `capture colo` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Security

- REQ-0091: Implement/preserve `upgrade Node` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0092: Implement/preserve `safe bind` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0093: Implement/preserve `inference auth` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0094: Implement/preserve `management auth` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0095: Implement/preserve `separate product auth` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0096: Implement/preserve `no secrets logs` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0097: Implement/preserve `no secrets UI` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0098: Implement/preserve `no .env package` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0099: Implement/preserve `Cloudflare secrets` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0100: Implement/preserve `origin auth` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

### Release Safety

- REQ-0101: Implement/preserve `remove runtime artifacts` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0102: Implement/preserve `remove credential dumps` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0103: Implement/preserve `remove QA profiles` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0104: Implement/preserve `package hygiene` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0105: Implement/preserve `review secret-pattern scripts` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0106: Implement/preserve `resolve retired modules` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0107: Implement/preserve `static safety` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0108: Implement/preserve `Node tests` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0109: Implement/preserve `exact source` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.
- REQ-0110: Implement/preserve `release only after gates` according to the architecture and provenance rules.
  - Evidence: code test, runtime probe, or Cloudflare verification depending on the requirement.
  - Status must be explicit: Verified, Reported, Planned, Blocked, or Not Implemented.

## 69. Detailed UI Acceptance Checklist

- UI-001: No fake live number.
- UI-002: Every operational value has source.
- UI-003: Unavailable has distinct state.
- UI-004: No hard-coded screenshot metric.
- UI-005: Snapshot health not presented live.
- UI-006: Live/reference fields do not silently mix.
- UI-007: Routing scores never recomputed.
- UI-008: Fallback attempts never invented.
- UI-009: Remaining quota never invented.
- UI-010: Colo never shown on local-only data.
- UI-011: Local-only evidence labeled.
- UI-012: Test distinct from production.
- UI-013: Production actions confirmed.
- UI-014: Unknown != zero.
- UI-015: Not observed != false.
- UI-016: Not configured distinct.
- UI-017: Unavailable alerts != empty alerts.
- UI-018: Audit timestamps source-only.
- UI-019: Operator identity not invented.
- UI-020: Gateway health not invented.
- UI-021: Provider writes capability-gated.
- UI-022: Model writes capability-gated.
- UI-023: Combo writes capability-gated.
- UI-024: Explainability shows source/version.
- UI-025: Traces separate edge/runtime.
- UI-026: Metrics separate edge/runtime.
- UI-027: Topology does not animate fake traffic.
- UI-028: Settings does not imply local routing.
- UI-029: Navigation does not label generic errors threats.
- UI-030: Credentials never reveal saved secret.
- UI-031: Cloudflare config never reveals secret.
- UI-032: Advanced OmniRoute links restricted.
- UI-033: Tables have loading/empty/error.
- UI-034: Filters work.
- UI-035: Search works.
- UI-036: Pagination works.
- UI-037: Export matches dataset.
- UI-038: Destructive actions name environment.
- UI-039: Version-sensitive features expose compatibility.
- UI-040: Source badges consistent.
- UI-041: Timestamps show timezone context.

## 70. Detailed Runtime Compatibility Checklist

- OR-001: CLI version 3.8.50.
- OR-002: Management auth required.
- OR-003: Reduced public monitoring handled.
- OR-004: Authenticated health validated.
- OR-005: Explain path correct.
- OR-006: Request-specific decision disabled.
- OR-007: Auto candidate disabled.
- OR-008: Combo read validated.
- OR-009: Combo write disabled pending proof.
- OR-010: Combo test disabled pending proof.
- OR-011: Quota plans metadata.
- OR-012: Pool usage semantics validated.
- OR-013: No breaker read inferred.
- OR-014: No cooldown read inferred.
- OR-015: No lockout read inferred.
- OR-016: Webhook disabled.
- OR-017: Attempts unavailable.
- OR-018: Future 3.8.51 gated.
- OR-019: Node secure minimum satisfied before prod.
- OR-020: Runtime bind hardened.
- OR-021: Inference auth hardened.
- OR-022: Launch from isolated runtime dir.
- OR-023: Project env not accidentally loaded.
- OR-024: No secrets in probes.
- OR-025: Read-only discovery.
- OR-026: No test data created solely for probing.

## 71. Detailed Release-Safety Checklist

- RS-001: No .env in package.
- RS-002: No provider/key dump.
- RS-003: No scratch credential dump.
- RS-004: No Chrome QA DB artifacts.
- RS-005: No node_modules in distributable.
- RS-006: No .wrangler cache.
- RS-007: No unintended dist duplication.
- RS-008: No API key literals.
- RS-009: No token literals.
- RS-010: No secret-like fixtures.
- RS-011: No retired router implementation.
- RS-012: No retired policy engine.
- RS-013: No retired firewall.
- RS-014: No retired health impersonation.
- RS-015: Static safety passes.
- RS-016: Node tests pass.
- RS-017: Vitest passes.
- RS-018: Lint passes.
- RS-019: Build passes.
- RS-020: Data verify passes.
- RS-021: Deploy config passes.
- RS-022: Migrations pass.
- RS-023: Worker version captured.
- RS-024: Production smoke passes.
- RS-025: Rollback documented.

## 72. Definition of Done by Layer

### OmniRoute Integration

- runtime version known
- read contracts version-correct
- write contracts explicit
- health semantics correct
- quota semantics correct
- explainability correct
- no inferred routing

### Control Plane

- routes use services
- services use adapters/repositories
- domain normalized
- provenance preserved
- capabilities gated
- errors structured
- unavailable tested

### UI

- truthful data
- no fake controls
- source-aware states
- workflows complete
- visual polish
- accessible
- test/prod distinction

### Cloudflare

- Worker deployed
- D1 configured
- migrations applied
- rate limit valid
- origin secure
- edge geography verified
- production identity recorded

### Security

- patched Node
- safe bind
- inference auth
- management auth
- origin auth
- secrets protected
- release clean

### Release

- mandatory gates pass
- exact source tied to deploy
- no blocked item misreported
- rollback ready
- production evidence recorded

## 73. Final Architecture Principles

- One routing authority: OmniRoute.
- One primary operator product: Secure-AI-Router UI.
- One edge/deployment substrate: Cloudflare.
- Multiple evidence sources, never silently merged.
- Provenance before convenience.
- Capability detection before UI enablement.
- Observed data before inference.
- Fail closed before fake fallback.
- Local and Cloudflare evidence remain distinct.
- Version reality beats assumptions.
- Small bounded changes beat rewrites.
- Production mutation follows test evidence.
- No secret exposure for debugging convenience.
- No green-by-workaround.
- No FINAL without exact-source verification.

## 74. Stable Handoff Summary

- Existing codebase; not a rebuild.
- Secure-AI-Router UI is final product UI.
- OmniRoute UI is secondary engine admin UI.
- OmniRoute 3.8.50 is current runtime baseline.
- Cloudflare is final deployment target.
- Production config intentionally fail-closed.
- Local backend/UI tests largely green.
- Static release safety still fails.
- Next safe infra step is isolated Cloudflare test.
- Next safe integration step is secure origin + edge verification.
- Local/runtime and geographic edge evidence must remain separate.

## Appendix A. Traceable Requirement Register

## Appendix B. Agent Execution Discipline

- Initialize Desktop/MCP only.
- Use exact path.
- No broad exploration unless task requires it.
- No Git unless asked.
- No production Cloudflare mutation unless asked.
- No secret reads/prints.
- No fake data.
- No unrelated historical verification.
- Use bounded plan for bounded task.
- Stop at stable checkpoint.
- Report exact evidence.

## End of Document

Update this blueprint only when newer validated evidence supersedes the facts above.
Never silently promote Reported, Planned, Blocked, or Not Implemented items to Verified.

