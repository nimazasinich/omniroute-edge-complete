export type DataSource =
  | 'omniroute'
  | 'cloudflare-worker'
  | 'cloudflare-analytics'
  | 'd1'
  | 'local-snapshot'
  | 'local-runtime';

export interface DataProvenance {
  source: DataSource;
  authoritative: boolean;
  observedAt: number;
  environmentId: string;
  warnings?: string[];
}

export interface ApiEnvelope<T> {
  apiVersion: 'v2';
  data: T;
  meta: {
    source: string;
    authoritative: boolean;
    requestId: string;
    observedAt: number;
    environmentId: string;
    warnings?: string[];
    pagination?: PaginationMeta;
    provenance: DataProvenance[];
  };
}

export interface PaginationMeta {
  offset: number;
  limit: number;
  returned: number;
  total: number;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  requestId: string;
  retryable: boolean;
  source: DataSource | 'control-api';
  details?: unknown;
}

export interface ApiErrorEnvelope {
  apiVersion: 'v2';
  error: ApiErrorDetail;
  meta: {
    requestId: string;
    observedAt: number;
    environmentId: string;
  };
}

export interface EnvironmentIdentity {
  id: string;
  label: string;
  mode: 'live' | 'degraded' | 'snapshot' | 'offline';
}

export interface OmniRouteRuntimeInfo {
  configured: boolean;
  reachable: boolean | null;
  version: string | null;
  build?: string | null;
  capabilities: string[];
  apiVariants: string[];
  probePath: '/v1/models';
  originHost: string | null;
  httpStatus: number | null;
  latencyMs: number | null;
  modelCount: number | null;
  error: string | null;
  provenance: DataProvenance;
}

export interface CapabilityDescriptor {
  id: string;
  label: string;
  supported: boolean;
  read: boolean;
  write: boolean;
  source: DataSource | 'control-api';
  reason?: string;
  requires?: string[];
  documented?: boolean;
  runtimeVerified?: boolean;
}

export interface CapabilityRegistry {
  generatedAt: number;
  environmentId: string;
  routingAuthority: 'omniroute';
  environment: EnvironmentIdentity;
  capabilities: CapabilityDescriptor[];
}

export interface SourceDiagnostic {
  id: string;
  label: string;
  source: DataSource;
  configured: boolean;
  reachable: boolean | null;
  authoritativeFor: string[];
  provenance: DataProvenance;
  warnings: string[];
}

export interface SystemStatus {
  environment: EnvironmentIdentity;
  routingAuthority: 'omniroute';
  controlPlane: {
    available: boolean;
    apiVersion: 'v2';
  };
  omniroute: OmniRouteRuntimeInfo;
}

export interface ProviderConnection {
  id: string;
  providerId: string;
  name: string;
  enabled: boolean;
  authType: string | null;
  accountLabel?: string;
  runtime: {
    health: 'healthy' | 'degraded' | 'open' | 'unknown';
    latencyMs?: number;
    circuitState?: string;
    lastError?: string;
    observedAt?: number;
  };
  tags: string[];
  provenance: DataProvenance;
}

export interface ModelDefinition {
  id: string;
  providerId: string | null;
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

export interface ComboTarget {
  providerId: string | null;
  connectionId: string | null;
  modelId: string | null;
  order: number;
  weight?: number;
  priority?: number;
  fallbackTier?: number;
}

export interface Combo {
  id: string;
  name: string;
  strategy: string | null;
  enabled: boolean | null;
  targets: ComboTarget[];
  auto?: {
    variant?: string;
    routerStrategy?: string;
    weights?: Record<string, number>;
    candidatePool?: string[];
  };
  revision: string | null;
  provenance: DataProvenance;
}

export interface ComboDraft {
  name: string;
  strategy: string;
  enabled?: boolean;
  targets: Array<{
    providerId?: string;
    connectionId?: string;
    modelId?: string;
    comboId?: string;
    weight?: number;
    priority?: number;
    fallbackTier?: number;
  }>;
  auto?: {
    variant?: string;
    routerStrategy?: string;
    weights?: Record<string, number>;
    candidatePool?: string[];
  };
}

export interface ComboPatch {
  expectedRevision: string;
  patch: Partial<ComboDraft>;
}

export interface ComboTestInput {
  model?: string;
  input: string;
}

export interface FieldDiff {
  path: string;
  before: unknown;
  after: unknown;
}

export interface ConfigRevision<T> {
  id: string;
  resourceType: 'combo';
  resourceId: string | null;
  expectedRevision: string | null;
  state: 'pending' | 'applied' | 'failed';
  before: T | null;
  after: T | null;
  diff: FieldDiff[];
  createdAt: number;
  appliedAt?: number;
  failureCode?: string;
}

export interface UnsupportedCapability {
  status: 'unsupported';
  capability: string;
  reason: string;
  documented: boolean;
  runtimeVerified: false;
}

export interface UnsupportedObservation {
  supported: false;
  reason: 'not-exposed' | 'runtime-unverified';
}

export interface RoutingTargetObservation {
  providerId: string | null;
  connectionId: string | null;
  modelId: string | null;
  comboId: string | null;
  comboStepId: string | null;
  comboExecutionKey: string | null;
}

export interface RoutingOutcome {
  requestId: string;
  correlationId: string | null;
  observedAt: number | null;
  requestedModel: string | null;
  selected: RoutingTargetObservation;
  statusCode: number | null;
  durationMs: number | null;
  strategy: null;
  reason: null;
  score: UnsupportedObservation;
  fallback: UnsupportedObservation & { attempts: [] };
  provenance: DataProvenance;
}

export interface RoutingDecisionDetail extends RoutingOutcome {
  sourceRecord: 'omniroute-call-log';
  explainability: {
    classification: 'omniroute-derived';
    generatedAt: number | null;
    routeType: string | null;
    confidence: string | null;
    summary: string | null;
    score: number | null;
    factors: unknown[];
    warnings: string[];
  };
  limitations: string[];
}

export interface AutoComboCandidate {
  providerId: string;
  connectionId: string;
  modelId: string;
  modelReference: string;
  excluded: boolean;
  reachable: boolean;
  breakerState: string;
  connectionCooldown: boolean;
  modelLocked: boolean;
  freeAccessExclusion: string | null;
}

export interface AutoComboInspection {
  channel: string;
  candidates: AutoComboCandidate[];
  dispatchPool: false;
  winner: UnsupportedObservation;
  warnings: string[];
  provenance: DataProvenance;
}

export interface RoutingExplainabilitySnapshot {
  classification: 'omniroute-derived';
  object: 'routing_explain';
  sinks: string[];
  otelEnabled: boolean;
  events: unknown[];
  quality: unknown[];
  otel: unknown | null;
  requestSpecific: false;
  provenance: DataProvenance;
}

export type AdapterReadResult<T> =
  | { status: 'ok'; data: T; provenance: DataProvenance }
  | { status: 'not-found' }
  | { status: 'unavailable'; httpStatus: number | null; reason: string };

export interface QuotaObservation {
  providerId: string;
  accountId: string;
  status: string;
  observedAt: number | null;
  resetAt: number | null;
  remainingPercent: number | null;
  used: number | null;
  limit: number | null;
}

export interface QuotaPlan {
  providerId: string;
  connectionId: string | null;
  source: string;
  dimensions: Array<{ unit: string; window: string; limit: number }>;
  remaining: UnsupportedObservation;
}

export interface ProviderCircuitBreakerState {
  providerId: string;
  state: string;
  failureCount: number | null;
  lastFailureAt: number | null;
  retryAfterMs: number | null;
}

export interface ConnectionCooldownState {
  providerId: string;
  coolingDown: number;
  total: number;
  soonestRetryAfterMs: number;
}

export interface ModelLockoutState {
  modelReference: string;
  reason: string | null;
  until: number | null;
  lockedAt: number | null;
  failureCount: number | null;
  lastFailureAt: number | null;
  resetAfterMs: number | null;
}

export interface ResilienceState {
  providerBreakers: ProviderCircuitBreakerState[];
  connectionCooldowns: ConnectionCooldownState[];
  modelLockouts: ModelLockoutState[];
  connectionFallback: UnsupportedObservation;
  comboFallback: UnsupportedObservation;
  provenance: DataProvenance;
}

export interface RequestIndexItem {
  requestId: string;
  correlationId: string | null;
  observedAt: number;
  clientId: string;
  path: string | null;
  requestType: string;
  requestedModel: string | null;
  status: string;
  statusCode: number | null;
  durationMs: number;
  streaming: boolean;
  error: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  cost: number | null;
  provenance: DataProvenance;
}

export interface TraceStage<T = unknown> {
  stage: 'edge-request' | 'omniroute-outcome' | 'omniroute-decision' | 'provider-attempts';
  status: 'observed' | 'exposed' | 'unavailable';
  data: T | null;
  reason?: string;
}

export interface RequestTrace {
  requestId: string;
  correlationId: string | null;
  stages: TraceStage[];
  complete: boolean;
  provenance: DataProvenance[];
}

export interface RequestMetrics {
  windowStart: number;
  windowEnd: number;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  blockedCount: number;
  averageDurationMs: number | null;
  observedTokensInput: number | null;
  observedTokensOutput: number | null;
  observedCost: number | null;
}

export interface CatalogResult<T> {
  items: T[];
  provenance: DataProvenance;
}

export interface CatalogPage<T> extends CatalogResult<T> {
  pagination: PaginationMeta;
}

export interface CatalogQuery {
  search?: string;
  providerId?: string;
  enabled?: boolean;
  sort: 'id' | 'name' | 'providerId';
  order: 'asc' | 'desc';
  offset: number;
  limit: number;
}
