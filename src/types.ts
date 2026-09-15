export interface ProviderMetadata {
  costPer1k?: number;
  baseLatency?: number;
  successRate?: number;
  trafficShare?: number;
  lastPing?: number;
  supportedModels?: string[];
  region?: string;
  [key: string]: unknown;
}

export interface Provider {
  id: string;
  name: string;
  type?: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
  status: 'Healthy' | 'Degraded' | 'Offline' | 'Disabled' | string;
  healthStatus?: 'healthy' | 'degraded' | 'offline' | string;
  latencyMs?: number | null;
  successRate?: number | null;
  costPerToken?: number | null;
  healthSource?: 'legacy_snapshot' | 'omniroute' | 'unknown';
  snapshotHealthStatus?: string | null;
  snapshotLatencyMs?: number | null;
  snapshotSuccessRate?: number | null;
  requestsLast24h?: number;
  trafficSharePct?: number;
  hasApiKey?: boolean;
  metadata?: ProviderMetadata | string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Model {
  id: string;
  name: string;
  modelName?: string;
  providerId: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  capabilities?: string[] | string;
  costPer1kPrompt?: number;
  costPer1kCompletion?: number;
  inputCost?: number;
  outputCost?: number;
  active?: boolean;
  enabled?: boolean;
}

export interface RoutingDecision {
  id?: string;
  timestamp: number;
  requestType: string;
  selectedModel: string;
  providerId?: string;
  routingReason: string;
  latency: number;
  clientIp?: string;
  tokensUsed?: number;
  cost?: number | null;
  cacheHit?: boolean;
}

export interface SecurityEvent {
  id?: string;
  timestamp: number;
  eventType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  sourceIp?: string;
  action: 'Blocked' | 'Challenged' | 'Logged' | 'Allowed';
  ruleTriggered?: string;
  details?: string;
}

export interface DashboardStats {
  totalRequests: number;
  activeProviders: number;
  healthyProviders?: number | null;
  degradedProviders: number | null;
  offlineProviders: number | null;
  providerHealthSource?: 'legacy_snapshot' | 'omniroute' | 'unknown';
  providerHealthAuthoritative?: boolean;
  avgLatency: number;
  blockedThreats: number;
  cacheHitRate?: number;
  estimatedCostSavings?: number | null;
}

export interface AnalyticsSeriesPoint {
  timestamp: number;
  count: number;
  avgLatencyMs?: number;
}

export interface AnalyticsProviderBucket {
  providerId: string | null;
  providerName: string;
  count: number;
  cost: number | null;
  avgLatencyMs: number;
}

export interface AnalyticsData {
  memoryUsage: number | null;
  memoryAllocated: number | null;
  cpuUsage: number | null;
  cpuTrend: number | null;
  requestsPerSec: number | null;
  requestsTrend: number | null;
  avgExecution: number | null;
  executionTrend: number | null;
  windowHours?: number;
  totalRequests?: number;
  avgLatencyMs?: number;
  totalTokens?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  estimatedCost?: number | null;
  byStatus?: Array<{ status: string; count: number }>;
  byRequestType?: Array<{ requestType: string; count: number }>;
  byProvider?: AnalyticsProviderBucket[];
  securityBySeverity?: Array<{ severity: string; count: number }>;
  requestVolumeSeries?: AnalyticsSeriesPoint[];
}

export interface RuntimeStatus {
  available: boolean;
  source: 'node-process' | 'unavailable';
  heapUsedMb: number | null;
  heapTotalMb: number | null;
  rssMb: number | null;
  cpuUserMs: number | null;
  cpuSystemMs: number | null;
  uptimeSeconds: number | null;
}

export interface OperationalCapabilities {
  routingAuthority: 'omniroute';
  providerManagement: boolean;
  modelManagement: boolean;
  routingRulesManagement: boolean;
  promptFirewall: boolean;
  gatewayAuthentication: true;
  perKeyRateLimiting: true;
  originValidation: true;
  requestTelemetry: 'd1-edge';
  providerInventorySource: 'legacy-read-model';
  modelInventorySource: 'legacy-read-model';
  securityEventSource: 'd1-observed-events';
  adminAuthSource: 'd1-hashed-admin-keys';
  environment: string | null;
}

export interface OmniRouteStatus {
  configured: boolean;
  reachable: boolean | null;
  checkedAt: number;
  originHost: string | null;
  probePath: '/v1/models';
  httpStatus: number | null;
  latencyMs: number | null;
  modelCount: number | null;
  modelIds: string[];
  error: string | null;
}

export interface SystemReadiness {
  ready: boolean;
  checkedAt: number;
  adminKeys: number;
  gatewayKeys: number;
  providerCount: number;
  enabledProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  offlineProviders: number;
  providerHealthSource?: 'legacy_snapshot' | 'omniroute' | 'unknown';
  providerHealthAuthoritative?: boolean;
  modelCount: number;
  enabledModelCount: number;
  policyCount: number;
  requestCount24h: number;
  errorCount24h: number;
  blockedCount24h: number;
  lastRequestAt: number | null;
  lastSecurityEventAt: number | null;
  issues: string[];
}

export interface OperationalAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  title: string;
  detail: string;
  timestamp: number;
  actionPath?: string;
  actionLabel?: string;
  source?: string;
}

export interface TopologySource {
  id: string;
  name: string;
  volume: number;
  type: string;
  status?: string;
}

export interface TopologyApplicationNode {
  id: string;
  label: string;
  sourceStatus: 'classified' | 'unknown';
  requestsLast24h: number;
  trafficSharePct: number;
  avgLatencyMs: number;
  type: string;
}

export interface TopologyProviderNode {
  id: string;
  label: string;
  type: string;
  health: 'healthy' | 'degraded' | 'offline' | 'disabled' | 'unknown';
  requestsLast24h: number;
  trafficSharePct: number;
  avgLatencyMs: number;
  latencySource: 'traffic' | 'health' | 'none';
  connectionState: 'observed' | 'configured';
  modelCount: number;
  enabledModelCount: number | null;
}

export interface TopologyData {
  nodes: {
    applications: TopologyApplicationNode[];
    edge: { label: string; totalRequestsLast24h: number };
    router: { label: string; totalRequestsLast24h: number };
    providers: TopologyProviderNode[];
  };
}

export interface ApiKeyItem {
  id: string;
  name: string;
  role: string;
  revoked: boolean;
  maskedKey: string;
  rawSecret?: string;
  createdAt?: number;
}

export interface SecurityPolicy {
  id: string;
  name?: string;
  type: string;
  value: string;
  config?: unknown;
  action: 'allow' | 'deny' | string;
  enabled?: boolean;
}

export interface DashboardData {
  stats: DashboardStats | null;
  analytics: AnalyticsData | null;
  topology: TopologyData | null;
  history: RoutingDecision[];
  securityEvents: SecurityEvent[];
  providers: Provider[];
  models: Model[];
  apiKeys?: ApiKeyItem[];
  policies?: SecurityPolicy[];
  runtime?: RuntimeStatus | null;
  readiness?: SystemReadiness | null;
  capabilities?: OperationalCapabilities | null;
  omniRouteStatus?: OmniRouteStatus | null;
  alerts?: OperationalAlert[] | null;
  loading: boolean;
  refetch: () => Promise<void>;
}
