# OmniRoute + Secure-AI-Router
# Deep Architecture & Comprehensive Upgrade Plan

**Document type:** Architecture specification + implementation roadmap  
**Revision:** 2.0 — Deep Architecture Edition  
**Date:** 2026-09-14  
**Language:** English  
**Primary goal:** Build a feature-rich, highly flexible, extensible control plane and operator UI around OmniRoute while keeping OmniRoute as the only provider-selection, retry, fallback, quota-aware, and routing execution authority.

---

# 0. Executive Summary

The project should evolve from a “dashboard + proxy” into a **layered AI Gateway Platform** with three explicit operational planes:

1. **Execution Plane** — OmniRoute
2. **Control Plane** — Secure-AI-Router application
3. **Observation Plane** — Cloudflare + durable read models + analytics

The architectural boundary is strict:

> **OmniRoute decides where an AI request is executed. Secure-AI-Router decides how operators configure, observe, organize, and interact with the system. Cloudflare provides the public edge, transport, deployment, and telemetry infrastructure.**

The upgraded platform should preserve the useful Secure-AI-Router capabilities—Providers, Models, Routing, API Keys, Logs, Traces, Metrics, Analytics, Alerts, Audit, Topology, Settings, configuration workflows, and extensibility—but should not preserve its old duplicate provider-selection engine.

The product should support:

- real OmniRoute provider/connection management;
- real model catalog management;
- real Combo management;
- Auto-Combo visibility and explainability;
- quota and resilience inspection;
- streaming inference;
- request tracing;
- routing-decision ingestion;
- flexible dashboards;
- configurable navigation;
- saved table views;
- multiple OmniRoute environments;
- version-aware capability detection;
- optional OmniRoute modules such as compression, playgrounds, webhooks, MCP, A2A, Skills, and Memory;
- a modular frontend that can grow without turning `App.tsx` into a monolith;
- a backend that separates edge proxy logic from control APIs and analytics logic;
- truthful provenance for every operational value.

Security-specific product features such as an “AI Firewall” are intentionally **not** a roadmap priority. Only the minimum security necessary for correct platform operation remains mandatory: authentication, secret handling, administrative access control, safe API-key storage, and Cloudflare deployment boundaries.

---

# 1. Research Basis and Design Rationale

This revision was cross-checked against current English-language documentation from:

- OmniRoute official GitHub repository and Wiki;
- OmniRoute API Reference;
- OmniRoute Architecture documentation;
- OmniRoute Auto-Combo documentation;
- OmniRoute Resilience Guide;
- OmniRoute v3.8.x roadmap toward a modular core + SDK + modules architecture;
- Cloudflare Workers;
- Cloudflare Tunnel;
- Cloudflare Service Bindings;
- Cloudflare D1;
- D1 read replication and Time Travel;
- Workers Analytics Engine;
- Cloudflare AI Gateway observability;
- Cloudflare React + Vite / Static Assets;
- Hono RPC and OpenAPI patterns;
- Drizzle ORM Cloudflare D1 support;
- React Router route modules, lazy loading, and error boundaries;
- TanStack Query;
- TanStack Table;
- TanStack Virtual;
- Radix Primitives;
- Backstage frontend plugin/extension architecture;
- Grafana dashboard variables/layout concepts;
- OpenTelemetry HTTP semantic conventions.

The architectural plan below does **not** blindly copy any one product. It combines patterns that fit the existing codebase and the target operating model.

---

# 2. Core Architectural Principles

## 2.1 One routing authority

OmniRoute owns:

- provider selection;
- provider connection selection;
- model selection after alias/combo resolution;
- Combo execution;
- Auto-Combo selection;
- retries;
- fallback ordering;
- quota-aware routing;
- circuit-breaker state;
- resilience state;
- routing strategies;
- provider availability;
- compression attached to routing configuration;
- model/provider execution.

Secure-AI-Router must never create a competing “best provider” result.

## 2.2 Control is not execution

Secure-AI-Router may:

- create/edit OmniRoute provider connections;
- create/edit Combos;
- edit model mappings;
- configure Gateway Profiles;
- inspect routing decisions;
- display scoring factors;
- compare providers/models;
- manage API keys;
- manage UI configuration;
- manage alerts;
- maintain configuration revisions.

It may **configure** routing behavior, but does not **execute** routing behavior.

## 2.3 Read models are not authorities

D1, local SQLite snapshots, Analytics Engine, and UI caches are read/observation models.

They may record what happened.

They may not override OmniRoute’s live runtime authority.

## 2.4 Data provenance is mandatory

Every operational value that can be confused with live runtime data must carry provenance.

Minimum metadata:

```ts
interface DataProvenance {
  source:
    | "omniroute"
    | "cloudflare-worker"
    | "cloudflare-analytics"
    | "d1"
    | "local-snapshot"
    | "local-runtime";
  authoritative: boolean;
  observedAt: number;
  environmentId: string;
  warnings?: string[];
}
```

## 2.5 No fabricated operational state

Never fabricate:

- provider health;
- traffic;
- latency;
- quota;
- cost;
- fallback;
- routing decisions;
- uptime;
- edge location counts;
- alerts;
- login state;
- loading progress.

Unknown means unknown.

---

# 3. System Layer Map

The upgraded platform is divided into **eleven explicit layers**.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ L10  Operations / Release / Verification                           │
├─────────────────────────────────────────────────────────────────────┤
│ L9   Frontend Feature Modules & Customizable Workspaces            │
├─────────────────────────────────────────────────────────────────────┤
│ L8   Frontend Platform Layer                                       │
│      Router / Query / UI State / Module Registry / Design System   │
├─────────────────────────────────────────────────────────────────────┤
│ L7   Backend API / BFF Layer                                       │
│      /api/v2/* / validation / envelopes / capability gating        │
├─────────────────────────────────────────────────────────────────────┤
│ L6   Application / Control Services                                │
│      workflows / revisions / profiles / alerts / aggregation       │
├─────────────────────────────────────────────────────────────────────┤
│ L5   Integration / Adapter Layer                                   │
│      OmniRoute / Cloudflare / D1 / Analytics / Local Snapshot      │
├─────────────────────────────────────────────────────────────────────┤
│ L4   Observation & Persistence Layer                               │
│      D1 / Analytics Engine / snapshots / revision history          │
├─────────────────────────────────────────────────────────────────────┤
│ L3   OmniRoute Execution Plane                                     │
│      providers / models / combos / routing / fallback / quota      │
├─────────────────────────────────────────────────────────────────────┤
│ L2   Edge Inference Gateway                                        │
│      auth / limits / request-id / stream passthrough / telemetry   │
├─────────────────────────────────────────────────────────────────────┤
│ L1   Network & Transport                                           │
│      Cloudflare / Tunnel / Service Bindings / origin connectivity  │
├─────────────────────────────────────────────────────────────────────┤
│ L0   External Clients & AI Providers                               │
└─────────────────────────────────────────────────────────────────────┘
```

Each layer must expose a stable interface to the layer above it.

No frontend component should know how OmniRoute stores providers.

No public gateway request should depend on dashboard rendering logic.

No D1 read-model query should decide a provider.

---

# 4. Layer L0 — External Clients and AI Providers

## 4.1 Clients

Supported client classes:

- OpenAI-compatible SDKs;
- CLI agents;
- coding assistants;
- custom applications;
- browser-based Model Playground;
- automation clients;
- MCP/A2A clients when optional modules are enabled.

Primary public inference contract:

```text
/v1/chat/completions
/v1/embeddings
/v1/models
```

Additional OmniRoute-compatible surfaces may be exposed only if the deployment requires them.

## 4.2 Providers

Providers are not modeled as a static list in Secure-AI-Router.

Provider truth comes from OmniRoute.

The control plane normalizes provider data for UX, but it does not own the canonical provider implementation.

## 4.3 Client identity

Every request should map to a non-secret logical client identity:

```ts
interface ClientIdentity {
  apiKeyId: string;
  tenantId?: string;
  projectId?: string;
  gatewayProfileId?: string;
  tags: string[];
}
```

The raw API key is never persisted in telemetry.

---

# 5. Layer L1 — Network and Transport

This layer follows the attached project plan.

## 5.1 Production topology

```text
Client
  ↓ HTTPS
Cloudflare Public Worker
  ↓
Cloudflare network
  ↓
Cloudflare Tunnel
  ↓
127.0.0.1:20128
  ↓
OmniRoute
  ↓
AI Providers
```

## 5.2 Tunnel responsibility

Cloudflare Tunnel exists only to transport traffic to the private OmniRoute origin.

It must not become a routing engine.

The origin should remain loopback-bound.

## 5.3 Candidate A / Candidate B decision

The attached plan requires evidence before deciding whether to:

### Candidate A
Extend the existing Cloudflare Worker already serving the provider gateway.

### Candidate B
Deploy a dedicated OmniRoute Edge Worker.

This decision remains mandatory before production resource creation.

The code architecture must work with either option.

Therefore:

- public edge logic lives behind an `EdgeGateway` interface;
- dashboard/control logic must not assume Worker name;
- infrastructure IDs must remain environment configuration;
- no Worker-specific name is hard-coded into business logic.

## 5.4 Future Worker separation

If the product grows, split:

```text
Inference Worker
Control Worker
Static App Worker
```

using Cloudflare Service Bindings.

Do **not** split prematurely.

The initial architecture may ship as one Worker if that is operationally simpler, but source boundaries must already separate:

```text
edge/
control/
analytics/
app-assets/
```

---

# 6. Layer L2 — Edge Inference Gateway

The inference gateway is the most latency-sensitive application code.

It must remain small.

## 6.1 Allowed responsibilities

For each inference request:

1. accept request;
2. assign/request correlation ID;
3. authenticate client;
4. apply platform-level request limits;
5. resolve client metadata/Gateway Profile if needed;
6. perform only request transformations allowed by Gateway Profile;
7. forward to OmniRoute;
8. preserve streaming;
9. record edge telemetry asynchronously;
10. return OmniRoute response.

## 6.2 Forbidden responsibilities

The Worker must never:

- rank providers;
- choose a fallback provider;
- retry a different provider;
- change provider based on latency;
- use D1 provider health to select a target;
- substitute a model because it “looks better”;
- reproduce OmniRoute Auto-Combo scoring.

## 6.3 Inference pipeline

```text
Request
  ↓
Request ID middleware
  ↓
API key/client resolution
  ↓
Rate-limit check
  ↓
Gateway Profile resolution
  ↓
Request normalization
  ↓
OmniRoute forward
  ↓
Streaming response passthrough
  ↓
Outcome telemetry
```

## 6.4 Streaming rules

The Worker must:

- never buffer the full SSE stream just to measure it;
- pass response body through;
- copy safe response headers;
- record status immediately;
- record completion asynchronously when possible;
- record first-byte timing only if measured, not approximated.

## 6.5 Edge failure semantics

Standard failures:

```text
401 AUTH_REQUIRED
403 CLIENT_DISABLED
413 REQUEST_TOO_LARGE
429 RATE_LIMITED
502 ORIGIN_UNAVAILABLE
504 ORIGIN_TIMEOUT
```

Errors must use the shared API error envelope for non-streaming failures.

## 6.6 Edge timeout policy

Timeout configuration must be a Gateway Profile concern, not provider-selection logic.

Example:

```ts
timeoutMs: 120_000
```

If a request times out:

- Worker returns a gateway timeout;
- OmniRoute decides whether internal provider fallback had already occurred;
- Worker does not initiate alternate provider logic.

---

# 7. Layer L3 — OmniRoute Execution Plane

OmniRoute is treated as a powerful external execution subsystem.

## 7.1 Capabilities to integrate

Priority order:

### P0
- provider connections;
- model catalog;
- Combos;
- Auto Combo;
- management status/version;
- provider health;
- routing decisions where exposed.

### P1
- quota;
- resilience;
- compression;
- model/Combo testing;
- registered keys where useful.

### P2
- webhooks;
- MCP;
- A2A;
- Skills;
- Memory;
- optional playground services.

## 7.2 Version awareness

The integration must probe:

```ts
interface OmniRouteRuntimeInfo {
  version: string;
  build?: string;
  capabilities: string[];
  apiVariants: string[];
}
```

Never assume that an endpoint exists because it exists in one OmniRoute release.

## 7.3 Provider concepts

Normalize four separate concepts:

```text
Provider Definition
Provider Connection
Provider Account/Credential
Available Models
```

Do not flatten them into one “provider” row.

## 7.4 Combo concepts

Represent:

- combo metadata;
- strategy;
- targets;
- target order;
- connection identity;
- model identity;
- weight/priority;
- fallback tier;
- health/readiness;
- Auto settings;
- mappings.

## 7.5 Auto Combo

Expose Auto Combo as a virtual routing feature.

UI must support:

```text
auto
auto/coding
auto/fast
auto/cheap
auto/offline
auto/smart
auto/lkgp
```

only when supported by the detected OmniRoute version.

## 7.6 Resilience

The UI must keep separate:

- provider circuit breaker;
- connection/account fallback;
- combo fallback.

These are separate OmniRoute resilience mechanisms and should not be collapsed into one “health” indicator.

---

# 8. Layer L4 — Observation and Persistence

The platform should stop treating one SQLite database as the answer to every data problem.

Use storage according to data shape.

## 8.1 D1 — relational operational store

D1 should contain control-plane and durable read-model data.

Recommended tables:

```text
request_index
request_attempt_index
routing_decision_index
config_revisions
gateway_profiles
dashboard_layouts
saved_views
operator_preferences
alert_rules
alert_events
audit_events
instance_profiles
integration_metadata
webhook_metadata_cache
```

## 8.2 Workers Analytics Engine — high-cardinality metrics

Store metrics such as:

- request count;
- duration;
- time to first byte;
- status;
- provider;
- connection;
- model;
- requested model;
- effective combo;
- API key ID;
- tenant;
- edge PoP;
- region;
- token counts;
- cost when authoritative;
- compression savings;
- fallback count;
- success/failure.

## 8.3 Local SQLite snapshot

The two existing local databases remain useful as:

- migration input;
- offline provider/model inventory;
- development fixtures from real historical data;
- recovery/reference snapshots.

They must not be presented as live health.

## 8.4 Source metadata

Every read-model object should carry:

```ts
meta: {
  source: string;
  authoritative: boolean;
  observedAt: number;
  environmentId: string;
}
```

## 8.5 Configuration revision store

Every mutation performed from Secure-AI-Router generates:

```ts
interface ConfigRevision {
  id: string;
  environmentId: string;
  resourceType: string;
  resourceId: string;
  action: "create" | "update" | "delete" | "enable" | "disable";
  beforeJson?: string;
  afterJson?: string;
  actorId?: string;
  status: "pending" | "applied" | "failed";
  createdAt: number;
  completedAt?: number;
  errorCode?: string;
}
```

Revision state must represent actual API mutation outcome.

---

# 9. Layer L5 — Integration and Adapter Layer

This layer is the most important long-term maintainability boundary.

## 9.1 Adapter set

```text
OmniRouteManagementAdapter
OmniRouteInferenceMetadataAdapter
OmniRouteTelemetryAdapter
CloudflareEdgeAdapter
CloudflareAnalyticsAdapter
D1RepositoryAdapter
LocalSnapshotAdapter
```

## 9.2 OmniRouteManagementAdapter

Responsibilities:

- detect version;
- detect management API availability;
- normalize provider connections;
- normalize models;
- normalize Combos;
- normalize Auto Combo;
- normalize quota;
- normalize resilience;
- execute supported management mutations;
- convert OmniRoute errors into domain errors.

Interface sketch:

```ts
interface OmniRouteManagementAdapter {
  getRuntimeInfo(): Promise<RuntimeInfo>;

  listProviderConnections(): Promise<ProviderConnection[]>;
  getProviderConnection(id: string): Promise<ProviderConnection>;
  createProviderConnection(input: CreateProviderConnectionInput): Promise<ProviderConnection>;
  updateProviderConnection(id: string, input: UpdateProviderConnectionInput): Promise<ProviderConnection>;
  setProviderConnectionEnabled(id: string, enabled: boolean): Promise<void>;
  testProviderConnection(id: string): Promise<ConnectionTestResult>;

  listModels(filter?: ModelFilter): Promise<ModelDefinition[]>;

  listCombos(): Promise<Combo[]>;
  createCombo(input: CreateComboInput): Promise<Combo>;
  updateCombo(id: string, input: UpdateComboInput): Promise<Combo>;
  deleteCombo(id: string): Promise<void>;
  testCombo(id: string, input: ComboTestInput): Promise<ComboTestResult>;

  getQuotaState(): Promise<QuotaState[]>;
  getResilienceState(): Promise<ResilienceState>;
}
```

The real method list must be aligned to the detected OmniRoute API version.

## 9.3 CloudflareAnalyticsAdapter

Responsibilities:

- execute read-only Analytics Engine queries;
- translate time range;
- translate dimensions;
- return normalized series;
- apply safe query limits;
- never accept arbitrary SQL from browser clients.

## 9.4 LocalSnapshotAdapter

Responsibilities:

- read the two verified local databases;
- expose provider/model inventory;
- mark all records `authoritative: false`;
- disable live health/quota fields.

It is a fallback for development and offline mode.

---

# 10. Layer L6 — Application / Control Services

Adapters should not be called directly from route handlers.

Application services coordinate workflows.

## 10.1 CapabilityService

Inputs:

- runtime version;
- available endpoint probes;
- configured Cloudflare bindings;
- storage availability.

Output:

```ts
interface CapabilityRegistry {
  generatedAt: number;
  environmentId: string;
  capabilities: Record<string, CapabilityDescriptor>;
}
```

Example keys:

```text
providers.read
providers.write
providers.test
models.read
combos.read
combos.write
autoCombo.read
quota.read
resilience.read
compression.read
compression.write
routing.decisions
webhooks.write
mcp.read
a2a.read
memory.read
```

## 10.2 ProviderService

Responsibilities:

- return provider/connection workspace model;
- merge non-authoritative request metrics into authoritative connection records;
- never overwrite OmniRoute health with D1 health;
- create revisions for mutations;
- invalidate affected caches after mutation.

## 10.3 ModelService

Responsibilities:

- normalize model catalog;
- join provider/connection metadata;
- attach observed usage;
- support server-side search/filter/sort;
- support model comparison payload.

## 10.4 ComboService

Responsibilities:

- validate UI draft;
- map UI draft to OmniRoute payload;
- create revision;
- call OmniRoute;
- persist mutation result;
- refresh Combo read model.

It does not execute a Combo itself except through a normal OmniRoute test request.

## 10.5 GatewayProfileService

Gateway Profiles remain Secure-AI-Router-owned because they govern client behavior before OmniRoute.

Responsibilities:

- CRUD;
- validation;
- matching;
- activation;
- revision;
- rollback;
- profile resolution for inference.

## 10.6 RequestObservabilityService

Responsibilities:

- correlate edge request ID and OmniRoute request ID;
- merge D1 and analytics data;
- produce trace timeline;
- return only observed stages.

## 10.7 DashboardService

Responsibilities:

- validate widget definitions;
- resolve widget data requirements;
- execute aggregated queries;
- return widget-ready datasets;
- keep widget definitions independent from raw SQL.

## 10.8 AlertService

Responsibilities:

- evaluate configured alert rules against observed data;
- create events;
- suppress duplicates;
- track acknowledgment;
- dispatch optional webhook actions.

---

# 11. Backend Domain Model

Use normalized domain types independent from OmniRoute raw JSON.

## 11.1 ProviderConnection

```ts
interface ProviderConnection {
  id: string;
  providerId: string;
  name: string;
  enabled: boolean;
  authType: string;
  accountLabel?: string;

  runtime: {
    health?: "healthy" | "degraded" | "open" | "unknown";
    latencyMs?: number;
    circuitState?: string;
    lastError?: string;
    observedAt?: number;
  };

  quota?: {
    remaining?: number;
    limit?: number;
    unit?: string;
    resetAt?: number;
  };

  tags: string[];
  provenance: DataProvenance;
}
```

## 11.2 ModelDefinition

```ts
interface ModelDefinition {
  id: string;
  providerId: string;
  connectionId?: string;
  displayName?: string;
  enabled?: boolean;

  capabilities: {
    chat?: boolean;
    reasoning?: boolean;
    tools?: boolean;
    vision?: boolean;
    audio?: boolean;
    video?: boolean;
    embeddings?: boolean;
  };

  limits?: {
    contextWindow?: number;
    maxOutputTokens?: number;
  };

  pricing?: {
    inputPerMillion?: number;
    outputPerMillion?: number;
    currency?: string;
  };

  provenance: DataProvenance;
}
```

## 11.3 Combo

```ts
interface Combo {
  id: string;
  name: string;
  strategy: string;
  enabled: boolean;

  targets: ComboTarget[];

  auto?: {
    variant?: string;
    routerStrategy?: string;
    weights?: Record<string, number>;
    candidatePool?: string[];
  };

  provenance: DataProvenance;
}
```

## 11.4 RequestRecord

```ts
interface RequestRecord {
  id: string;
  environmentId: string;

  startedAt: number;
  completedAt?: number;

  apiKeyId?: string;
  tenantId?: string;
  gatewayProfileId?: string;

  path: string;
  requestedModel?: string;
  resolvedModel?: string;
  comboId?: string;

  providerId?: string;
  connectionId?: string;

  statusCode?: number;
  errorType?: string;

  latencyMs?: number;
  ttftMs?: number;

  inputTokens?: number;
  outputTokens?: number;
  cost?: number;

  fallbackCount?: number;

  traceId?: string;
  omniRouteRequestId?: string;
}
```

---

# 12. Backend API / BFF Layer — L7

The browser should consume a versioned application API.

## 12.1 API version

Use:

```text
/api/v2/*
```

Keep old routes during migration.

## 12.2 Standard response envelope

```ts
interface ApiEnvelope<T> {
  data: T;
  meta: {
    source: string;
    authoritative: boolean;
    observedAt: number;
    environmentId: string;
    apiVersion: "v2";
    warnings?: string[];
    pagination?: PaginationMeta;
  };
}
```

## 12.3 Standard error envelope

```ts
interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
    retryable: boolean;
  };
}
```

## 12.4 Core endpoints

### System

```text
GET /api/v2/system/status
GET /api/v2/system/capabilities
GET /api/v2/system/sources
GET /api/v2/system/environment
```

### Providers

```text
GET    /api/v2/providers
GET    /api/v2/providers/:connectionId
POST   /api/v2/providers
PATCH  /api/v2/providers/:connectionId
DELETE /api/v2/providers/:connectionId
POST   /api/v2/providers/:connectionId/test
POST   /api/v2/providers/:connectionId/enable
POST   /api/v2/providers/:connectionId/disable
```

### Models

```text
GET /api/v2/models
GET /api/v2/models/:modelId
GET /api/v2/models/compare?ids=...
```

### Combos

```text
GET    /api/v2/combos
GET    /api/v2/combos/:id
POST   /api/v2/combos
PATCH  /api/v2/combos/:id
DELETE /api/v2/combos/:id
POST   /api/v2/combos/:id/test
POST   /api/v2/combos/:id/clone
```

### Auto Combo

```text
GET /api/v2/routing/auto
GET /api/v2/routing/decisions
GET /api/v2/routing/decisions/:requestId
```

### Quota

```text
GET /api/v2/quotas
GET /api/v2/quotas/history
```

### Resilience

```text
GET /api/v2/resilience
GET /api/v2/resilience/providers/:providerId
```

### Requests

```text
GET /api/v2/requests
GET /api/v2/requests/:id
GET /api/v2/requests/:id/trace
```

### Analytics

```text
GET /api/v2/analytics/summary
GET /api/v2/analytics/timeseries
GET /api/v2/analytics/breakdown
GET /api/v2/analytics/top
```

### Gateway Profiles

```text
GET    /api/v2/gateway-profiles
POST   /api/v2/gateway-profiles
GET    /api/v2/gateway-profiles/:id
PATCH  /api/v2/gateway-profiles/:id
DELETE /api/v2/gateway-profiles/:id
POST   /api/v2/gateway-profiles/:id/activate
GET    /api/v2/gateway-profiles/:id/revisions
POST   /api/v2/gateway-profiles/:id/rollback/:revisionId
```

### UI Preferences

```text
GET  /api/v2/ui/preferences
PUT  /api/v2/ui/preferences
GET  /api/v2/ui/dashboards
POST /api/v2/ui/dashboards
PUT  /api/v2/ui/dashboards/:id
DELETE /api/v2/ui/dashboards/:id
GET  /api/v2/ui/saved-views
POST /api/v2/ui/saved-views
```

## 12.5 Validation

All mutation bodies must be schema-validated.

Recommended:

- Zod;
- Hono Zod integration/OpenAPI;
- generated OpenAPI document for `/api/v2`.

## 12.6 Type sharing

Prefer shared contract types.

Hono RPC-style inferred typing can be used internally, but a documented OpenAPI contract should still exist for:

- external integration;
- testing;
- future non-React consumers;
- versioned compatibility.

---

# 13. Backend Project Structure

Recommended target structure:

```text
src/
  app/
    api/
      v2/
        system.routes.ts
        providers.routes.ts
        models.routes.ts
        combos.routes.ts
        routing.routes.ts
        quotas.routes.ts
        resilience.routes.ts
        requests.routes.ts
        analytics.routes.ts
        gatewayProfiles.routes.ts
        uiPreferences.routes.ts

  edge/
    gateway.ts
    auth.ts
    rateLimit.ts
    requestId.ts
    profileResolver.ts
    forwardToOmniRoute.ts
    edgeTelemetry.ts

  domain/
    providers/
      types.ts
      provider.service.ts
    models/
      types.ts
      model.service.ts
    combos/
      types.ts
      combo.service.ts
    routing/
      types.ts
      routing.service.ts
    quotas/
    resilience/
    requests/
    analytics/
    gatewayProfiles/
    alerts/
    revisions/

  integrations/
    omniroute/
      client.ts
      versionProbe.ts
      capabilityProbe.ts
      management.adapter.ts
      telemetry.adapter.ts
      mappers/
    cloudflare/
      analytics.adapter.ts
      edge.adapter.ts
    snapshot/
      snapshot.adapter.ts

  db/
    schema.ts
    repositories/
    migrations/

  shared/
    contracts/
    errors/
    pagination/
    provenance/
    time/
    validation/

  worker.ts
```

Route handlers should be thin.

Bad:

```text
route handler
  -> raw SQL
  -> raw OmniRoute fetch
  -> merge
  -> business rules
  -> response
```

Good:

```text
route handler
  -> validate
  -> service
  -> adapters/repositories
  -> normalized domain result
  -> envelope
```

---

# 14. Mutation Workflow

Every management mutation follows one common state machine.

```text
UI draft
  ↓
Client-side validation
  ↓
POST/PATCH /api/v2/...
  ↓
Server validation
  ↓
Capability check
  ↓
Create pending revision
  ↓
Call OmniRoute
  ↓
Success?
  ├─ yes → mark revision applied → invalidate cache → return resource
  └─ no  → mark revision failed  → return structured error
```

## 14.1 No optimistic mutation for authoritative OmniRoute configuration

Do not show a Combo or provider connection as changed until OmniRoute confirms it.

Use pessimistic confirmation for:

- provider create/update;
- Combo create/update;
- quota-affecting config;
- resilience reset;
- webhook mutation.

Optimistic UI is acceptable for:

- UI preferences;
- dashboard layout;
- local saved filters.

---

# 15. Idempotency and Concurrency

## 15.1 Idempotency

Support `Idempotency-Key` for mutation endpoints where duplicate browser submission could create duplicate resources.

## 15.2 Configuration concurrency

Use revision/version fields.

Mutation request:

```ts
{
  expectedRevision: "rev-123",
  patch: {...}
}
```

Conflict:

```text
409 CONFIG_REVISION_CONFLICT
```

UI shows:

- your draft;
- current server value;
- diff;
- reload;
- reapply.

---

# 16. Caching Strategy

Caching must be capability-aware.

## 16.1 Short cache

Good candidates:

- runtime info;
- provider definitions;
- model catalog;
- capability registry.

## 16.2 No stale authority

Do not serve stale cached values as live when:

- provider health;
- quota;
- circuit breaker;
- live request trace;
- active alert state.

If cached data is used during degradation, provenance must indicate:

```text
authoritative=false
warning=stale
```

---

# 17. Frontend Layer Map

```text
L9  Feature Workspaces
    Providers / Models / Combos / Routing / Quota / Logs / etc.

L8  Frontend Platform
    Module Registry
    Router
    Query Client
    UI Preferences
    Design System
    Table Platform
    Dashboard Platform
    Command Palette
    Error Boundaries

L7  Typed API Client
    /api/v2/*
```

The feature pages must depend on L8 abstractions, not on `fetch()` scattered through components.

---

# 18. Frontend Application Shell

The shell owns global navigation and context.

## 18.1 Shell components

```text
AppRoot
 ├─ AppProviders
 │   ├─ QueryClientProvider
 │   ├─ ThemeProvider
 │   ├─ EnvironmentProvider
 │   ├─ CapabilityProvider
 │   └─ UiPreferencesProvider
 │
 ├─ AppShell
 │   ├─ Header
 │   ├─ Sidebar
 │   ├─ CommandPalette
 │   ├─ GlobalStatusStrip
 │   └─ RouteOutlet
```

## 18.2 Header

Header should contain:

- active environment/instance;
- global search;
- current source mode:
  - LIVE
  - DEGRADED
  - SNAPSHOT
  - OFFLINE
- notifications;
- command palette;
- appearance shortcut;
- operator/account if configured.

## 18.3 Sidebar

Sidebar is registry-driven.

No hard-coded `if route === ...` tree in one file.

Sections:

```text
Overview
Operate
Observe
Configure
Integrations
System
```

Users may:

- hide modules;
- reorder modules;
- collapse sections;
- favorite pages.

Required core pages cannot be fully removed; they may be hidden from navigation and remain command-searchable.

---

# 19. Frontend Module Registry

## 19.1 Module descriptor

```ts
interface UiModule {
  id: string;
  title: string;
  route: string;
  section: string;
  order: number;
  icon: React.ComponentType;

  requiredCapabilities?: string[];
  defaultVisible: boolean;

  lazy: () => Promise<{
    Component: React.ComponentType;
  }>;
}
```

## 19.2 Module behavior

At runtime:

```text
registry
  ↓
capability registry
  ↓
user visibility settings
  ↓
navigation model
  ↓
lazy route model
```

## 19.3 Extension slots

Expose:

```text
dashboard.widgets
provider.details.tabs
model.details.tabs
combo.editor.panels
routing.details
trace.details.tabs
settings.sections
header.actions
sidebar.modules
```

Extensions are build-time TypeScript registrations initially.

No remote JavaScript plugin execution.

---

# 20. Frontend Routing

Use modern route modules or equivalent route-level code splitting.

## 20.1 Route responsibilities

Each route owns:

- page component;
- page error boundary;
- page-level query prefetch if required;
- route metadata;
- breadcrumb;
- capability requirement.

## 20.2 Lazy routes

Large optional modules should load lazily:

- Analytics;
- Combo Studio;
- Playground;
- MCP;
- A2A;
- Memory;
- Webhooks.

## 20.3 Error boundaries

Provide:

- root error boundary;
- workspace-level error boundaries;
- widget-level failure isolation.

A failed Analytics chart must not blank the whole application.

---

# 21. Frontend Server-State Logic

Use TanStack Query for API state.

## 21.1 Query ownership

Examples:

```ts
["system", environmentId, "capabilities"]
["providers", environmentId, filters]
["models", environmentId, filters]
["combos", environmentId]
["routing", environmentId, "auto"]
["requests", environmentId, filters]
["trace", environmentId, requestId]
["analytics", environmentId, metric, range, dimensions]
```

## 21.2 Refresh intervals

Suggested:

```text
Capabilities       60s
Provider inventory 60s
Model catalog      5–15m
Provider health    10–30s
Quota              30–60s
Requests           5–10s
Active trace       2–5s until terminal
Analytics          30–60s
```

Actual values should remain configurable.

## 21.3 Mutation invalidation

Provider mutation:

```text
providers
provider detail
capabilities if relevant
models if connection affects model availability
quota
```

Combo mutation:

```text
combos
routing
models mappings
```

## 21.4 Retry policy

Automatic retries only for safe reads.

No automatic retry for mutations unless the operation is proven idempotent.

---

# 22. Frontend Client-State Logic

Do not put server data into a global client store.

Client state includes:

- theme;
- density;
- sidebar;
- dashboard layout;
- local draft state;
- command palette;
- selected rows;
- temporary comparison list.

Server state remains in TanStack Query.

URL state owns shareable filters.

Example:

```text
/models?provider=openai&capability=vision&sort=contextWindow.desc
```

---

# 23. Design System Layer

Preserve the existing visual direction.

Formalize it.

## 23.1 Tokens

```text
color.background
color.surface
color.surfaceMuted
color.border
color.text
color.textMuted
color.accent
color.success
color.warning
color.danger

space.*
radius.*
shadow.*
font.*
motion.*
```

## 23.2 Density

Support:

```text
compact
comfortable
```

## 23.3 Accessible primitives

Incrementally use Radix-style primitives for:

- Dialog;
- Popover;
- Dropdown;
- Select;
- Tabs;
- Tooltip;
- Context Menu.

The design remains custom.

---

# 24. Shared Data Workspace Platform

All large resource pages should use one shared data-workspace framework.

## 24.1 Features

- search;
- server filtering;
- faceted filtering;
- sorting;
- pagination;
- virtualization;
- column visibility;
- column order;
- resizing;
- pinned columns;
- row selection;
- bulk actions;
- saved view;
- export view;
- detail inspector.

## 24.2 Desktop layout

```text
┌────────────────────────────────────────────────────────────┐
│ Page Header / Source / Actions                             │
├────────────────────────────────────────────────────────────┤
│ KPI / summary strip                                       │
├────────────────────────────────────────────────────────────┤
│ Search | Filters | Saved View | Columns | Export           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Data Table / Virtualized Workspace                         │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Selection / Pagination                                    │
└────────────────────────────────────────────────────────────┘
```

Optional master-detail:

```text
Table 65% | Inspector 35%
```

---

# 25. Providers Workspace — Detailed Frontend Logic

## 25.1 Purpose

Manage real OmniRoute provider connections.

## 25.2 Data requirements

```text
GET providers
GET provider health
GET quota
GET recent provider traffic aggregate
```

The backend composes the page model.

## 25.3 Page header

Show:

- total connections;
- enabled connections;
- health-known connections;
- degraded/open count;
- data source.

## 25.4 Table columns

Configurable:

- provider;
- connection name;
- enabled;
- auth type;
- health;
- circuit state;
- latency;
- quota;
- reset;
- requests 24h;
- error rate;
- last error;
- tags.

## 25.5 Inspector tabs

```text
Overview
Models
Quota
Health
Traffic
Configuration
History
```

## 25.6 Actions

Depending on capability:

```text
Create
Edit
Test
Enable
Disable
Delete
Clone configuration
```

If `providers.write=false`, action UI is hidden or read-only.

---

# 26. Models Workspace — Detailed Frontend Logic

## 26.1 Scale

The UI must comfortably support hundreds or thousands of models.

Use:

- server-side filter;
- server-side sorting;
- virtualization where needed.

## 26.2 Facets

- provider;
- connection;
- modality;
- reasoning;
- tools;
- vision;
- context bucket;
- cost bucket;
- availability.

## 26.3 Comparison

User selects up to five models.

Comparison matrix:

```text
Context
Output limit
Reasoning
Tools
Vision
Audio
Input cost
Output cost
Provider
Observed latency
Observed success
Quota relevance
```

Only real fields display values.

---

# 27. Combo Studio — Detailed Frontend Logic

Combo Studio is a first-class editor.

## 27.1 Modes

```text
Structured Editor
Visual Flow
Raw JSON Preview
History
Test
```

## 27.2 Draft architecture

```ts
interface ComboDraft {
  baseRevision?: string;
  name: string;
  strategy: string;
  targets: ComboTargetDraft[];
  auto?: AutoDraft;
}
```

Draft remains browser-local until saved.

## 27.3 Structured editor

Each target row:

```text
Provider
Connection
Model
Priority
Weight
Fallback tier
Enabled
```

## 27.4 Validation

Client validation:

- required fields;
- duplicate tuple;
- numeric ranges.

Server validation:

- capability;
- connection exists;
- model exists;
- OmniRoute accepted strategy.

## 27.5 Save

```text
Save
  ↓
validate
  ↓
show diff
  ↓
confirm
  ↓
mutation
  ↓
success → update baseRevision
```

## 27.6 Visual Flow

Graph nodes are a representation of the same draft.

No independent execution graph.

Structured and visual editors mutate one shared draft state.

---

# 28. Routing Intelligence Workspace

## 28.1 Purpose

Explain OmniRoute decisions.

## 28.2 Views

```text
Live Decisions
Auto Modes
Decision Detail
Strategy Reference
Historical Trends
```

## 28.3 Decision detail

Display only fields available from runtime/telemetry:

```text
requested model
resolved combo
candidate list
excluded candidates
selected provider
selected connection
selected model
score factors
fallback attempts
quota state
circuit state
latency signals
reason
```

If OmniRoute does not expose score breakdown, display:

```text
Decision source: OmniRoute
Score breakdown: Not exposed by this runtime version
```

Do not reverse-engineer a fake score.

---

# 29. Quota Center

## 29.1 Layout

```text
Quota summary
  ↓
Provider/Connection quota table
  ↓
Reset timeline
  ↓
Historical consumption
```

## 29.2 States

```text
healthy
warning
critical
exhausted
unknown
```

Thresholds may be user-configurable visualization thresholds but must not change OmniRoute routing unless OmniRoute configuration explicitly supports it.

---

# 30. Resilience Center

Separate panels:

```text
Provider Circuit Breakers
Connection Failover
Combo Fallback
Recent Incidents
Recovery Probes
```

No single “health score” should hide these distinct mechanisms.

---

# 31. Requests / Logs Workspace

## 31.1 Filters

- time;
- status;
- provider;
- model;
- combo;
- API key;
- tenant;
- request ID;
- error;
- streaming;
- region.

## 31.2 Table

Columns:

```text
Time
Request ID
Client
Requested Model
Resolved Target
Provider
Status
Latency
TTFT
Tokens
Cost
Fallbacks
Region
```

## 31.3 Request detail

Tabs:

```text
Overview
Trace
Routing
Attempts
Usage
Headers (safe subset)
Errors
```

Never expose secrets.

---

# 32. Traces Workspace

Trace visualization:

```text
00ms   Edge Receive
04ms   Gateway Profile
08ms   Forward to OmniRoute
17ms   OmniRoute Accepted
22ms   Routing Decision
31ms   Provider Attempt #1
405ms  First Token
1920ms Completed
```

If intermediate timestamps are unavailable, omit them.

Do not fabricate timing.

OpenTelemetry-compatible naming should be used where practical.

---

# 33. Metrics Workspace

Dedicated Metrics page.

## 33.1 Metrics

- requests/sec;
- success rate;
- error rate;
- p50;
- p95;
- p99;
- TTFT;
- tokens;
- cost;
- fallbacks;
- quota warnings;
- provider availability;
- edge traffic.

## 33.2 Dimensions

- environment;
- provider;
- connection;
- model;
- combo;
- API key;
- tenant;
- region.

## 33.3 Source labels

Every chart displays source:

```text
Analytics Engine
OmniRoute
D1
Local Runtime
```

---

# 34. Analytics Workspace

Analytics is exploratory.

Metrics is operational.

Separate them.

Analytics sections:

```text
Traffic
Providers
Models
Clients
Cost
Tokens
Reliability
Routing
Quota
Compression
Regions
```

Each panel can open a filtered Requests workspace.

---

# 35. Flexible Dashboard Platform

## 35.1 Widget definition

```ts
interface DashboardWidgetDefinition {
  id: string;
  title: string;
  capability?: string;

  defaultSize: {
    w: number;
    h: number;
  };

  query: WidgetQueryDefinition;

  renderer: React.ComponentType;
}
```

## 35.2 Widget instance

```ts
interface DashboardWidgetInstance {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  options: Record<string, unknown>;
}
```

## 35.3 Edit mode

User can:

- add;
- remove;
- move;
- resize;
- configure;
- duplicate supported widgets;
- save;
- reset.

## 35.4 Dashboard variables

Global variables:

```text
environment
time range
provider
connection
model
combo
API key
region
```

Widgets inherit them unless overridden.

## 35.5 Presets

```text
Overview
Operations
Reliability
Cost
Quota
Developer
Custom
```

---

# 36. Settings Workspace

Settings becomes a structured control center.

## General

- active instance;
- default landing page;
- language;
- time zone.

## Appearance

- light;
- dark;
- system;
- accent;
- density;
- font scale;
- reduced motion;
- chart animation.

## Navigation

- module visibility;
- ordering;
- favorites;
- collapsed sections.

## Dashboard

- default dashboard;
- global refresh;
- default time range.

## Data

- source diagnostics;
- snapshot status;
- retention indicators;
- cache status.

## OmniRoute

- runtime status;
- version;
- capability matrix;
- management endpoint;
- gateway endpoint.

## Cloudflare

- Worker readiness;
- D1 readiness;
- Analytics Engine readiness;
- Tunnel status if observable.

## Integrations

- webhooks;
- optional modules;
- external notifications.

## Advanced

- API contract diagnostics;
- capability dump;
- configuration export;
- UI preferences export;
- migration tools.

---

# 37. Multiple OmniRoute Environments

Support multiple explicit environments.

```ts
interface EnvironmentProfile {
  id: string;
  name: string;
  kind: "production" | "staging" | "local";

  managementEndpoint: string;
  inferenceEndpoint?: string;

  enabled: boolean;
}
```

Examples:

```text
Production VPS
Staging VPS
Local Windows
Development Snapshot
```

## 37.1 Environment switching

Switching environment:

1. update active environment;
2. clear/invalidate environment-scoped queries;
3. fetch capabilities;
4. fetch system status;
5. navigate to same route if supported;
6. otherwise navigate to Overview.

No environment state is implicitly synchronized.

---

# 38. API Keys / Client Workspace

Upgrade API Keys from a simple credential table into a client management workspace.

Metadata:

```text
Name
Tenant
Project
Status
Created
Last Used
Usage
Default Gateway Profile
Default Combo
Tags
Expiry
Budget metadata
```

Actions:

```text
Create
Rotate
Revoke
Edit metadata
View usage
```

Raw secret shown once after creation.

---

# 39. Gateway Profiles

Gateway Profiles preserve useful Secure-AI-Router flexibility without recreating routing.

## 39.1 Profile matching

May match:

- API key;
- tenant;
- path;
- client tag.

## 39.2 Request settings

May configure:

- default model;
- model aliases;
- request metadata;
- timeout;
- body size;
- telemetry tags.

## 39.3 Target

A profile targets:

```text
OmniRoute model ID
or
OmniRoute Combo ID
or
auto/* identifier
```

It never selects an upstream provider directly.

---

# 40. Alerts

Alert rules are control-plane-owned.

Example:

```ts
interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;

  source: string;
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: number;
  windowSec: number;

  filters: Record<string, string>;

  cooldownSec: number;
}
```

Initial alert targets:

- origin down;
- provider degraded;
- circuit open;
- quota low;
- quota exhausted;
- error rate;
- latency;
- cost;
- no expected traffic.

---

# 41. Optional OmniRoute Modules

Optional modules must not burden the base application.

## 41.1 Compression

Page:

```text
Current modes
Usage
Token savings
Per-Combo settings
Recent compression
```

## 41.2 Model Playground

Real request executor.

Controls:

```text
environment
model/combo
messages
temperature
stream
```

Outputs:

```text
stream
latency
TTFT
tokens
provider
connection
routing
cost
request ID
```

## 41.3 Translator Playground

Optional module for translation/testing features exposed by OmniRoute.

## 41.4 Webhooks

CRUD + test.

## 41.5 MCP

Status + tools + audit.

## 41.6 A2A

Status + capabilities + activity.

## 41.7 Skills

Inventory and usage.

## 41.8 Memory

Status, scoped records, health, usage.

---

# 42. Authentication and Security Minimum

Security is not the feature focus, but the following are non-negotiable.

## 42.1 Public inference

API key.

## 42.2 Admin dashboard

Cloudflare Access or equivalent verified identity in production.

## 42.3 OmniRoute management credential

Server-side only.

Never sent to browser.

## 42.4 Secrets

Never stored in:

- UI preferences;
- telemetry;
- D1 configuration snapshots;
- frontend bundle;
- planning documents.

---

# 43. Remove Fake Login and Fake Loading

The current visual login/loading flows must not simulate backend state.

Production behavior:

```text
Cloudflare Access identity
  ↓
App boot
  ↓
system/status
  ↓
capabilities
  ↓
environment
  ↓
render shell
```

Loading text should reflect real boot stages only.

No timer-driven fake authentication.

---

# 44. Frontend Boot Sequence

```text
1. Load static shell
2. Resolve admin identity
3. Load UI preferences
4. Resolve active environment
5. GET /api/v2/system/status
6. GET /api/v2/system/capabilities
7. Build module/navigation registry
8. Render active route
9. Begin route-specific queries
```

If step 5 fails:

```text
App mode = DEGRADED/OFFLINE
```

Do not block local Settings/diagnostics unnecessarily.

---

# 45. Application Modes

## LIVE

OmniRoute and required telemetry reachable.

## DEGRADED

Some sources unavailable.

## SNAPSHOT

Local snapshot inventory used.

## OFFLINE

Only local cached configuration/preferences available.

Mode is displayed globally.

---

# 46. Observability Event Architecture

Normalize events.

```ts
type PlatformEvent =
  | "request.received"
  | "request.forwarded"
  | "request.completed"
  | "request.failed"
  | "routing.decision"
  | "provider.attempt"
  | "provider.success"
  | "provider.failure"
  | "fallback.started"
  | "fallback.completed"
  | "quota.warning"
  | "quota.exhausted"
  | "connection.changed"
  | "config.changed";
```

## 46.1 Correlation

Carry:

```text
x-request-id
```

Map:

```text
edge request id
OmniRoute request id
trace id
request row id
routing decision id
```

---

# 47. Analytics Event Shape

Workers Analytics Engine data-point mapping should use bounded dimensions.

Example conceptual mapping:

```text
blobs:
  environmentId
  providerId
  connectionId
  modelId
  comboId
  apiKeyId
  statusClass
  region

doubles:
  latencyMs
  ttftMs
  inputTokens
  outputTokens
  cost
  fallbackCount

indexes:
  request partition key
```

Exact field mapping must respect Analytics Engine limits in the implementation version.

---

# 48. D1 Schema Direction

Example normalized tables:

```sql
request_index(
  id TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  api_key_id TEXT,
  requested_model TEXT,
  resolved_model TEXT,
  combo_id TEXT,
  provider_id TEXT,
  connection_id TEXT,
  status_code INTEGER,
  latency_ms INTEGER,
  ttft_ms INTEGER,
  error_type TEXT,
  omni_request_id TEXT,
  trace_id TEXT
);

config_revisions(
  id TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  status TEXT NOT NULL,
  actor_id TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_code TEXT
);

gateway_profiles(...);
dashboard_layouts(...);
saved_views(...);
operator_preferences(...);
alert_rules(...);
alert_events(...);
audit_events(...);
```

Migrations are version-controlled.

No schema mutation at random application startup.

---

# 49. Read Replication Strategy

If D1 read replication is enabled:

- use the Sessions API;
- use sessions for user/request flows requiring sequential consistency;
- do not assume a replica is immediately current;
- write operations still go to primary.

Do not enable read replication until query patterns justify it.

---

# 50. Local Development Architecture

Local development must reproduce interfaces, not fake production facts.

```text
React/Vite
  ↓
Local Hono server
  ↓
Adapters:
  - real local OmniRoute if available
  - snapshot adapter if explicitly selected
  - local SQLite
```

Local snapshot mode must say SNAPSHOT.

---

# 51. Backend Testing Architecture

## Unit tests

Test:

- mappers;
- validation;
- Gateway Profile resolution;
- capability gating;
- error mapping;
- revision logic.

## Contract tests

Test:

- OmniRoute adapter responses;
- missing endpoint;
- changed field;
- old version;
- unsupported feature.

## Integration tests

With real test OmniRoute:

- list providers;
- list models;
- create Combo;
- update Combo;
- test Combo;
- real inference;
- fallback;
- routing decision ingestion.

## Edge tests

- auth;
- rate limit;
- timeout;
- streaming;
- origin failure.

---

# 52. Frontend Testing Architecture

## Component

- primitives;
- forms;
- table controls;
- source badges.

## Workspace

- provider filtering;
- model comparison;
- Combo draft validation;
- dashboard edit mode;
- environment switching.

## Browser

Playwright:

```text
1368 × 753 canonical
```

Test:

- every navigation route;
- no console error;
- data source state;
- real empty state;
- degraded state;
- saved view persistence;
- layout persistence;
- Combo edit flow;
- provider edit flow;
- trace drill-down.

---

# 53. No-Fabrication Test Suite

Add dedicated tests.

Examples:

```text
No hardcoded dashboard KPI values
No provider health inferred from provider.enabled
No source "omniroute" when fallback is snapshot
No fake edge location counts
No fake routing decision
No fake cost
No fake loading progress
No fake authentication state
No PASS from skipped test
```

---

# 54. Performance Architecture

## Backend hot path

Keep inference Worker dependency chain minimal.

Do not wait for:

- D1 analytics query;
- dashboard data;
- expensive aggregation.

Telemetry write should be asynchronous where correctness permits.

## Frontend

Use:

- route lazy loading;
- query caching;
- server-side pagination;
- table virtualization;
- module code splitting.

Do not fetch all 400+ models on every page if not needed.

---

# 55. Customization Persistence

## Anonymous/local

`localStorage`.

## Authenticated operator

D1 preferences.

## Export/import

JSON.

Example export:

```json
{
  "version": 1,
  "theme": "dark",
  "density": "compact",
  "navigation": {},
  "dashboards": [],
  "savedViews": []
}
```

No secrets.

---

# 56. Command Palette

Global command palette improves flexibility.

Commands:

```text
Go to Providers
Go to Models
Go to Combo Studio
Switch Environment
Create Combo
Create Provider Connection
Open Request by ID
Open Model Playground
Toggle Theme
Customize Dashboard
```

Commands are capability-gated.

---

# 57. Global Search

Search categories:

- providers;
- connections;
- models;
- Combos;
- request IDs;
- API key metadata;
- pages/settings.

Search result must identify source/resource type.

No raw secret search.

---

# 58. Configuration Diff UX

Every management change should show a meaningful diff.

Example:

```diff
strategy:
- priority
+ auto

targets[1].weight:
- 0.25
+ 0.40
```

Provide JSON view and human summary.

---

# 59. Audit UX

Audit entries:

- actor;
- environment;
- resource;
- action;
- result;
- request ID;
- revision ID;
- timestamp.

Audit page can open corresponding revision or request.

---

# 60. Frontend Directory Structure

Recommended:

```text
src/
  app/
    AppRoot.tsx
    router.tsx
    providers.tsx

  platform/
    modules/
      registry.ts
      types.ts
    capabilities/
    query/
    preferences/
    dashboard/
    table/
    commandPalette/
    designSystem/

  features/
    overview/
    providers/
    models/
    combos/
    routing/
    quotas/
    resilience/
    requests/
    traces/
    metrics/
    analytics/
    alerts/
    apiKeys/
    audit/
    settings/
    playground/
    compression/
    webhooks/
    mcp/
    a2a/
    memory/

  components/
    primitives/
    charts/
    dataDisplay/

  api/
    client.ts
    contracts.ts
    queryKeys.ts

  styles/
    tokens.css
    globals.css
```

Feature folders own their page-level code.

---

# 61. Feature Folder Contract

Example:

```text
features/providers/
  ProvidersPage.tsx
  ProviderDetailPanel.tsx
  ProviderEditor.tsx
  provider.columns.tsx
  provider.filters.ts
  provider.queries.ts
  provider.mutations.ts
  provider.module.ts
```

Avoid one huge `views.tsx`.

---

# 62. Page State Contract

Every page must define:

```text
Loading
Ready
Empty
Degraded
Error
Unsupported
Read-only
```

No generic spinner forever.

---

# 63. Capability-Gated UI Logic

Example:

```text
providers.read=false
  → module hidden or Unsupported

providers.read=true
providers.write=false
  → page visible, mutations hidden

providers.write=true
  → full editor
```

This is more flexible than deployment-time feature flags.

---

# 64. Future Plugin Direction

OmniRoute itself is moving toward a modular architecture.

Secure-AI-Router should be prepared, not overengineered.

Phase 1:

```text
build-time plugin registry
```

Future:

```text
workspace packages
```

Not:

```text
remote arbitrary JS
```

---

# 65. What to Retire from Current Code

Retire or replace:

- local provider-routing/scoring engine;
- local fallback engine;
- legacy `router.ts` authority;
- legacy `policy.ts` routing authority;
- monolithic dashboard fetch;
- hard-coded nav;
- hard-coded fake KPIs;
- fake login/loading timers;
- health provenance bugs;
- local SQLite treated as live OmniRoute;
- duplicate “routing rules” that directly pick provider.

---

# 66. What to Preserve

Preserve:

- current visual foundation;
- working Dashboard components;
- Providers/Models tables as migration starting points;
- Logs;
- Traces;
- Analytics;
- Metrics;
- Alerts;
- Audit;
- existing Hono foundation;
- Drizzle/D1 integration;
- request correlation where implemented;
- current two DB snapshots;
- current no-fabrication philosophy.

---

# 67. Migration Strategy

Do not rewrite everything at once.

Use strangler migration.

```text
Old API + Old UI
       ↓
Add /api/v2 + adapters
       ↓
Move one workspace
       ↓
Verify
       ↓
Move next workspace
       ↓
Retire old endpoint
```

---

# 68. Implementation Phase 0 — Baseline

Deliverables:

- exact source snapshot;
- git diff;
- current tests;
- current routes;
- current endpoint matrix;
- DB inventory;
- screenshot baseline;
- capability matrix;
- attached-plan Candidate A/B investigation status.

Exit criteria:

```text
No unknown baseline.
```

---

# 69. Phase 1 — Layer Boundaries

Build:

- domain contracts;
- API envelope;
- error model;
- provenance model;
- capability service;
- OmniRoute client;
- version probe;
- source diagnostics.

No page redesign yet.

Exit:

- `/api/v2/system/*` works;
- capability registry visible.

---

# 70. Phase 2 — Provider + Model Vertical Slice

Build:

- provider adapter;
- model adapter;
- provider service;
- model service;
- endpoints;
- Providers Workspace;
- Models Workspace;
- saved table state.

Exit:

- real OmniRoute providers/models shown;
- snapshot fallback explicitly marked.

This is the first major proof.

---

# 71. Phase 3 — Combo Studio

Build:

- Combo adapter;
- Combo service;
- Combo API;
- structured editor;
- validation;
- diff;
- revisions;
- test request.

Exit:

- create/edit/delete/test Combo through new UI.

---

# 72. Phase 4 — Routing Intelligence

Build:

- Auto Combo discovery;
- routing decision normalization;
- decision list;
- detail page;
- request correlation.

Exit:

- real request shows real OmniRoute routing result.

---

# 73. Phase 5 — Quota + Resilience

Build:

- quota adapter;
- resilience adapter;
- Quota Center;
- Resilience Center.

Exit:

- OmniRoute authoritative state visible separately.

---

# 74. Phase 6 — Observability Data Plane

Build:

- request index;
- attempt index;
- Analytics Engine event schema;
- trace aggregation;
- Metrics;
- Analytics.

Exit:

- one request traceable edge → OmniRoute → provider.

---

# 75. Phase 7 — Frontend Platform

Build:

- module registry;
- capability-gated nav;
- query architecture;
- shared table platform;
- design token layer;
- settings preferences;
- environment selector;
- command palette.

Exit:

- new feature can register itself without central sidebar rewrite.

---

# 76. Phase 8 — Flexible Dashboards

Build:

- widget registry;
- layout editor;
- dashboard variables;
- presets;
- saved dashboards.

Exit:

- layouts persist by user/environment.

---

# 77. Phase 9 — Gateway Profiles

Build:

- profile schema;
- profile CRUD;
- profile matching;
- inference integration;
- revisions.

Exit:

- different clients can target different OmniRoute model/Combo identifiers without duplicate routing.

---

# 78. Phase 10 — Optional Modules

One at a time:

- Compression;
- Playground;
- Webhooks;
- MCP;
- A2A;
- Skills;
- Memory.

Each module gets separate capability gate and test suite.

---

# 79. Phase 11 — Cloudflare Production Alignment

Complete attached deployment runbook:

- inspect overlap;
- Candidate A/B;
- production D1/KV decision;
- VPS;
- Docker OmniRoute;
- Tunnel;
- public gateway;
- Access;
- edge limits;
- external scans;
- uptime monitor.

This phase cannot be closed from code alone.

---

# 80. Phase 12 — Release Verification

Run on exact source:

```text
typecheck
lint
unit
integration
contract
browser
build
deploy dry-run
deploy
runtime probes
end-to-end inference
fallback test
restart test
telemetry verification
```

BLOCKED / SKIP / UNVERIFIED are never PASS.

---

# 81. Acceptance Matrix

## Architecture

- [ ] OmniRoute is sole routing authority.
- [ ] Worker has no provider-selection logic.
- [ ] D1 has no routing authority.
- [ ] snapshot has no live-health authority.
- [ ] adapters isolate OmniRoute API shape.

## Backend

- [ ] `/api/v2` contracts documented.
- [ ] mutation validation exists.
- [ ] revisions exist.
- [ ] capabilities are runtime-derived.
- [ ] provenance exists.
- [ ] analytics separated from control data.

## Frontend

- [ ] registry-driven navigation.
- [ ] route-level lazy loading.
- [ ] resource query ownership.
- [ ] flexible tables.
- [ ] configurable dashboard.
- [ ] saved views.
- [ ] multiple environments.
- [ ] explicit live/degraded/snapshot/offline modes.

## Feature coverage

- [ ] providers.
- [ ] models.
- [ ] Combos.
- [ ] Auto Combo.
- [ ] quotas.
- [ ] resilience.
- [ ] requests.
- [ ] traces.
- [ ] metrics.
- [ ] analytics.
- [ ] API keys.
- [ ] audit.
- [ ] settings.

## Verification

- [ ] real streamed inference.
- [ ] real routing attribution.
- [ ] real fallback.
- [ ] real provider health.
- [ ] real quota.
- [ ] real telemetry.
- [ ] browser verification.
- [ ] restart/recovery.

---

# 82. Definition of Done

The platform is complete when:

1. Operators no longer need the old Secure-AI-Router routing engine.
2. Operators can perform routine OmniRoute management from the new UI.
3. OmniRoute remains authoritative for all routing decisions.
4. Every major page declares data source/provenance.
5. UI is modular and customizable.
6. Dashboard layout is user-configurable.
7. Large tables are scalable and customizable.
8. multiple OmniRoute instances are explicit.
9. observability correlates edge → OmniRoute → provider.
10. optional advanced features do not bloat the base shell.
11. no fabricated operational values exist.
12. production deployment satisfies the attached runbook with real evidence.

---

# 83. Recommended First Implementation Slice

Do not start with another large visual redesign.

Implement:

```text
1. /api/v2 envelope
2. provenance
3. capabilities
4. OmniRoute version probe
5. OmniRouteManagementAdapter
6. ProviderService
7. ModelService
8. Providers Workspace
9. Models Workspace
10. ComboService
11. Combo Studio structured editor
12. one real inference request
13. real routing decision ingestion
14. trace detail
```

Why:

If this works, the three hardest architectural boundaries are proven:

```text
UI ↔ Control API
Control API ↔ OmniRoute Management
Inference/Telemetry ↔ Observability UI
```

Everything else can grow from these interfaces.

---

# 84. Suggested Repository End-State

```text
src/
  worker.ts

  edge/
    inferenceGateway/
    telemetry/

  api/
    v2/

  domain/
    providers/
    models/
    combos/
    routing/
    quotas/
    resilience/
    gatewayProfiles/
    requests/
    analytics/
    alerts/
    revisions/

  integrations/
    omniroute/
    cloudflare/
    snapshot/

  db/
    schema/
    repositories/
    migrations/

  frontend/
    app/
    platform/
    features/
    components/
    api/
    styles/

tests/
  unit/
  contract/
  integration/
  browser/
  no-fabrication/

drizzle/
docs/
```

If moving the existing `src/` tree into `src/frontend/` is too disruptive, preserve the current folder and apply the same boundaries incrementally.

---

# 85. Research References

## OmniRoute

- Official Wiki  
  https://github.com/diegosouzapw/OmniRoute/wiki

- Architecture  
  https://github.com/diegosouzapw/OmniRoute/wiki/Architecture

- API Reference  
  https://github.com/diegosouzapw/OmniRoute/wiki/API-Reference

- Features  
  https://github.com/diegosouzapw/OmniRoute/wiki/Features

- Auto Combo  
  https://github.com/diegosouzapw/OmniRoute/wiki/Auto-Combo

- Resilience Guide  
  https://github.com/diegosouzapw/OmniRoute/wiki/Resilience-Guide

- v3.8.51 Roadmap  
  https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.51/ROADMAP.md

- v3.8.51 Resilience Guide  
  https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.51/docs/architecture/RESILIENCE_GUIDE.md

- MCP Server  
  https://github.com/diegosouzapw/OmniRoute/wiki/MCP-Server

## Cloudflare

- Cloudflare Tunnel  
  https://developers.cloudflare.com/tunnel/

- Tunnel Configuration  
  https://developers.cloudflare.com/tunnel/configuration/

- Service Bindings  
  https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/

- Workers RPC  
  https://developers.cloudflare.com/workers/runtime-apis/rpc/

- Workers Rate Limiting  
  https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

- D1 Read Replication  
  https://developers.cloudflare.com/d1/best-practices/read-replication/

- Workers Analytics Engine  
  https://developers.cloudflare.com/analytics/analytics-engine/

- React + Vite  
  https://developers.cloudflare.com/workers/framework-guides/web-apps/react/

- Static Assets  
  https://developers.cloudflare.com/workers/static-assets/

- AI Gateway Analytics  
  https://developers.cloudflare.com/ai-gateway/observability/analytics/

- AI Gateway Metadata  
  https://developers.cloudflare.com/ai-gateway/observability/custom-metadata/

## Backend

- Hono RPC  
  https://hono.dev/docs/guides/rpc

- Hono Zod OpenAPI  
  https://hono.dev/examples/zod-openapi

- Drizzle + D1  
  https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1

## Frontend

- React Router Route Modules  
  https://reactrouter.com/start/framework/route-module

- React Router Error Boundaries  
  https://reactrouter.com/how-to/error-boundary

- React Router Lazy Route Discovery  
  https://reactrouter.com/explanation/lazy-route-discovery

- TanStack Query Important Defaults  
  https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

- TanStack Query Keys  
  https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

- TanStack Table Virtualization  
  https://tanstack.com/table/latest/docs/framework/react/guide/virtualization

- TanStack Table Column Visibility  
  https://tanstack.com/table/latest/docs/framework/react/guide/column-visibility

- Radix Primitives  
  https://www.radix-ui.com/primitives

- Backstage Frontend Plugins  
  https://backstage.io/docs/frontend-system/architecture/plugins/

- Backstage Frontend Extensions  
  https://backstage.io/docs/frontend-system/architecture/extensions/

- Grafana Dashboard Variables  
  https://grafana.com/docs/grafana/latest/visualizations/dashboards/variables/

## Observability

- OpenTelemetry HTTP Semantic Conventions  
  https://opentelemetry.io/docs/specs/semconv/http/

---

# 86. Final Architecture Statement

> **OmniRoute is the execution intelligence. Secure-AI-Router is the feature-rich, configurable control plane and operator experience. Cloudflare is the edge, transport, deployment, and telemetry substrate. The frontend is a modular workspace platform, and the backend is a version-aware adapter-driven control API—never a second router.**
