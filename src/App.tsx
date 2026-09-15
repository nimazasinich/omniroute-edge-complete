import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import type {
  AnalyticsData, DashboardData, DashboardStats, Model, OmniRouteStatus,
  OperationalAlert, OperationalCapabilities, Provider, RoutingDecision,
  RuntimeStatus, SecurityEvent, SystemReadiness, TopologyData,
} from './types';

import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { TopologyView } from './components/TopologyView';
import { ProvidersSection } from './components/ProvidersView';
import { Models } from './components/ModelsView';
import { RoutingRulesView } from './components/RoutingRulesView';
import { ApiKeysView } from './components/ApiKeysView';
import { SecurityPoliciesView } from './components/SecurityPoliciesView';
import { FirewallView } from './components/FirewallView';
import { LogsView } from './components/LogsView';
import { AnalyticsView } from './components/AnalyticsView';
import { MetricsView } from './components/MetricsView';
import { AlertsView } from './components/AlertsView';
import { SettingsView } from './components/SettingsView';
import { TracesView } from './components/TracesView';
import { AuditLogView } from './components/AuditLogView';
import { DreamWorkerAuthScreen } from './components/DreamWorkerAuthScreen';
import { DreamWorkerLoadingScreen } from './components/DreamWorkerLoadingScreen';
import { AnonymousOnlyRoute, AuthProvider, ProtectedRoute } from './auth/AuthProvider';

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : {};
}

function asNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function envelopeData(value: unknown): unknown {
  const record = asRecord(value);
  return record.apiVersion === 'v2' && 'data' in record ? record.data : value;
}

function envelopeItems(value: unknown): unknown[] {
  const data = envelopeData(value);
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  return Array.isArray(record.items) ? record.items : [];
}

function capabilitySupported(registry: ApiRecord, id: string): boolean {
  const capabilities = Array.isArray(registry.capabilities) ? registry.capabilities : [];
  return capabilities.some((item) => {
    const capability = asRecord(item);
    return capability.id === id && capability.supported === true;
  });
}

function titleHealth(value: unknown, enabled: unknown = true): Provider['status'] {
  if (enabled === false || enabled === 0) return 'Disabled';
  const text = String(value ?? '').toLowerCase();
  if (text === 'healthy') return 'Healthy';
  if (text === 'degraded') return 'Degraded';
  if (text === 'offline') return 'Offline';
  if (text === 'disabled') return 'Disabled';
  return text ? text[0].toUpperCase() + text.slice(1) : 'Unknown';
}

function normalizeProvider(row: unknown): Provider {
  const p = asRecord(row);
  const metadata = asRecord(p.metadata);
  const runtime = asRecord(p.runtime);
  const provenance = asRecord(p.provenance);
  const healthStatus = p.healthStatus ?? p.status ?? runtime.health;
  const latencyMs = asOptionalNumber(p.latencyMs ?? runtime.latencyMs);
  const successRate = asOptionalNumber(p.successRate);
  const costPerToken = asOptionalNumber(p.costPerToken);
  const trafficSharePct = asNumber(p.trafficSharePct ?? metadata.trafficShare, 0);
  return {
    id: String(p.id ?? ''),
    name: String(p.name ?? 'Unknown Provider'),
    type: p.providerId ? String(p.providerId) : p.type ? String(p.type) : undefined,
    baseUrl: String(p.baseUrl ?? p.base_url ?? ''),
    enabled: p.enabled !== false && p.enabled !== 0,
    priority: asNumber(p.priority, 1),
    status: titleHealth(healthStatus, p.enabled),
    healthStatus: String(healthStatus ?? 'unknown') as Provider['healthStatus'],
    latencyMs,
    successRate,
    costPerToken,
    healthSource: String(p.healthSource ?? provenance.source ?? 'unknown') as Provider['healthSource'],
    snapshotHealthStatus: p.snapshotHealthStatus === null || p.snapshotHealthStatus === undefined ? null : String(p.snapshotHealthStatus),
    snapshotLatencyMs: asOptionalNumber(p.snapshotLatencyMs),
    snapshotSuccessRate: asOptionalNumber(p.snapshotSuccessRate),
    requestsLast24h: asNumber(p.requestsLast24h, 0),
    trafficSharePct,
    hasApiKey: Boolean(p.hasApiKey),
    metadata: { ...metadata, trafficShare: trafficSharePct, provenanceSource: provenance.source, authoritative: provenance.authoritative },
    createdAt: asOptionalNumber(p.createdAt ?? p.created_at) ?? undefined,
  };
}

function normalizeModel(row: unknown): Model {
  const m = asRecord(row);
  const limits = asRecord(m.limits);
  const pricing = asRecord(m.pricing);
  const capabilities = asRecord(m.capabilities);
  const capabilityList = Object.entries(capabilities).filter(([, value]) => value === true).map(([key]) => key);
  return {
    id: String(m.id ?? m.modelName ?? m.name ?? ''),
    name: String(m.name ?? m.displayName ?? m.modelName ?? 'Unknown Model'),
    providerId: String(m.providerId ?? m.provider_id ?? ''),
    contextWindow: asOptionalNumber(m.contextWindow ?? limits.contextWindow) ?? undefined,
    maxOutputTokens: asOptionalNumber(m.maxOutputTokens ?? limits.maxOutputTokens) ?? undefined,
    capabilities: capabilityList.length ? capabilityList : m.capabilities as Model['capabilities'],
    costPer1kPrompt: asOptionalNumber(m.inputCost ?? pricing.inputPerMillion) ?? undefined,
    costPer1kCompletion: asOptionalNumber(m.outputCost ?? pricing.outputPerMillion) ?? undefined,
    active: m.enabled !== false && m.enabled !== 0,
    enabled: m.enabled !== false && m.enabled !== 0,
  };
}

function normalizeStats(row: unknown): DashboardStats | null {
  const s = asRecord(row);
  if (!Object.keys(s).length) return null;
  return {
    totalRequests: asNumber(s.totalRequests ?? s.totalRequestsLast24h, 0),
    activeProviders: asNumber(s.activeProviders, 0),
    healthyProviders: asOptionalNumber(s.healthyProviders),
    degradedProviders: asOptionalNumber(s.degradedProviders),
    offlineProviders: asOptionalNumber(s.offlineProviders),
    providerHealthSource: String(s.providerHealthSource ?? 'unknown') as DashboardStats['providerHealthSource'],
    providerHealthAuthoritative: Boolean(s.providerHealthAuthoritative),
    avgLatency: asNumber(s.avgLatency ?? s.avgLatencyMs, 0),
    blockedThreats: asNumber(s.blockedThreats ?? s.blockedThreatsLast24h, 0),
    estimatedCostSavings: asOptionalNumber(s.estimatedCostLast24h),
  };
}

function normalizeAnalytics(row: unknown): AnalyticsData | null {
  const a = asRecord(envelopeData(row));
  if (!Object.keys(a).length) return null;
  const tokensIn = asOptionalNumber(a.tokensIn ?? a.observedTokensInput);
  const tokensOut = asOptionalNumber(a.tokensOut ?? a.observedTokensOutput);
  return {
    memoryUsage: asOptionalNumber(a.memoryUsage),
    memoryAllocated: asOptionalNumber(a.memoryAllocated),
    cpuUsage: asOptionalNumber(a.cpuUsage),
    cpuTrend: asOptionalNumber(a.cpuTrend),
    requestsPerSec: asOptionalNumber(a.requestsPerSec),
    requestsTrend: asOptionalNumber(a.requestsTrend),
    avgExecution: asOptionalNumber(a.avgExecution ?? a.avgLatencyMs ?? a.averageDurationMs),
    executionTrend: asOptionalNumber(a.executionTrend),
    windowHours: asNumber(a.windowHours, 24),
    totalRequests: asNumber(a.totalRequests, 0),
    avgLatencyMs: asNumber(a.avgLatencyMs ?? a.averageDurationMs, 0),
    totalTokens: a.totalTokens !== undefined ? asOptionalNumber(a.totalTokens) : tokensIn === null && tokensOut === null ? null : (tokensIn ?? 0) + (tokensOut ?? 0),
    tokensIn,
    tokensOut,
    estimatedCost: asOptionalNumber(a.estimatedCost ?? a.observedCost),
    byStatus: Array.isArray(a.byStatus) ? a.byStatus.map((item) => ({ status: String(asRecord(item).status ?? 'unknown'), count: asNumber(asRecord(item).count, 0) })) : [],
    byRequestType: Array.isArray(a.byRequestType) ? a.byRequestType.map((item) => ({ requestType: String(asRecord(item).requestType ?? 'unknown'), count: asNumber(asRecord(item).count, 0) })) : [],
    byProvider: Array.isArray(a.byProvider) ? a.byProvider.map((item) => {
      const provider = asRecord(item);
      return {
        providerId: provider.providerId === null || provider.providerId === undefined ? null : String(provider.providerId),
        providerName: String(provider.providerName ?? 'Unknown'),
        count: asNumber(provider.count, 0),
        cost: asOptionalNumber(provider.cost),
        avgLatencyMs: asNumber(provider.avgLatencyMs, 0),
      };
    }) : [],
    securityBySeverity: Array.isArray(a.securityBySeverity) ? a.securityBySeverity.map((item) => ({ severity: String(asRecord(item).severity ?? 'unknown'), count: asNumber(asRecord(item).count, 0) })) : [],
    requestVolumeSeries: Array.isArray(a.requestVolumeSeries) ? a.requestVolumeSeries.map((point) => ({
      timestamp: asNumber(asRecord(point).timestamp, 0),
      count: asNumber(asRecord(point).count, 0),
      avgLatencyMs: asOptionalNumber(asRecord(point).avgLatencyMs) ?? undefined,
    })) : [],
  };
}

function mergeAnalyticsSources(rich: AnalyticsData | null, normalizedV2: AnalyticsData | null): AnalyticsData | null {
  if (!rich) return normalizedV2;
  if (!normalizedV2) return rich;
  return {
    ...normalizedV2,
    ...rich,
    memoryUsage: rich.memoryUsage ?? normalizedV2.memoryUsage,
    memoryAllocated: rich.memoryAllocated ?? normalizedV2.memoryAllocated,
    cpuUsage: rich.cpuUsage ?? normalizedV2.cpuUsage,
    cpuTrend: rich.cpuTrend ?? normalizedV2.cpuTrend,
    requestsPerSec: rich.requestsPerSec ?? normalizedV2.requestsPerSec,
    requestsTrend: rich.requestsTrend ?? normalizedV2.requestsTrend,
    avgExecution: rich.avgExecution ?? normalizedV2.avgExecution,
    executionTrend: rich.executionTrend ?? normalizedV2.executionTrend,
    totalTokens: rich.totalTokens ?? normalizedV2.totalTokens,
    tokensIn: rich.tokensIn ?? normalizedV2.tokensIn,
    tokensOut: rich.tokensOut ?? normalizedV2.tokensOut,
    estimatedCost: rich.estimatedCost ?? normalizedV2.estimatedCost,
    byStatus: rich.byStatus?.length ? rich.byStatus : normalizedV2.byStatus,
    byRequestType: rich.byRequestType?.length ? rich.byRequestType : normalizedV2.byRequestType,
    byProvider: rich.byProvider?.length ? rich.byProvider : normalizedV2.byProvider,
    securityBySeverity: rich.securityBySeverity?.length ? rich.securityBySeverity : normalizedV2.securityBySeverity,
    requestVolumeSeries: rich.requestVolumeSeries?.length ? rich.requestVolumeSeries : normalizedV2.requestVolumeSeries,
  };
}

function normalizeRuntime(row: unknown): RuntimeStatus | null {
  const r = asRecord(row);
  if (!Object.keys(r).length) return null;
  return {
    available: Boolean(r.available),
    source: r.source === 'node-process' ? 'node-process' : 'unavailable',
    heapUsedMb: asOptionalNumber(r.heapUsedMb),
    heapTotalMb: asOptionalNumber(r.heapTotalMb),
    rssMb: asOptionalNumber(r.rssMb),
    cpuUserMs: asOptionalNumber(r.cpuUserMs),
    cpuSystemMs: asOptionalNumber(r.cpuSystemMs),
    uptimeSeconds: asOptionalNumber(r.uptimeSeconds),
  };
}

function normalizeReadiness(row: unknown): SystemReadiness | null {
  const r = asRecord(row);
  if (!Object.keys(r).length) return null;
  return {
    ready: Boolean(r.ready), checkedAt: asNumber(r.checkedAt, 0), adminKeys: asNumber(r.adminKeys, 0), gatewayKeys: asNumber(r.gatewayKeys, 0),
    providerCount: asNumber(r.providerCount, 0), enabledProviders: asNumber(r.enabledProviders, 0), healthyProviders: asNumber(r.healthyProviders, 0),
    degradedProviders: asNumber(r.degradedProviders, 0), offlineProviders: asNumber(r.offlineProviders, 0),
    providerHealthSource: String(r.providerHealthSource ?? 'unknown') as SystemReadiness['providerHealthSource'],
    providerHealthAuthoritative: Boolean(r.providerHealthAuthoritative), modelCount: asNumber(r.modelCount, 0),
    enabledModelCount: asNumber(r.enabledModelCount, 0), policyCount: asNumber(r.policyCount, 0), requestCount24h: asNumber(r.requestCount24h, 0),
    errorCount24h: asNumber(r.errorCount24h, 0), blockedCount24h: asNumber(r.blockedCount24h, 0), lastRequestAt: asOptionalNumber(r.lastRequestAt),
    lastSecurityEventAt: asOptionalNumber(r.lastSecurityEventAt), issues: asStringArray(r.issues),
  };
}

function normalizeCapabilities(row: unknown): OperationalCapabilities | null {
  const r = asRecord(envelopeData(row));
  if (!Object.keys(r).length || r.routingAuthority !== 'omniroute') return null;
  if (Array.isArray(r.capabilities)) {
    return {
      routingAuthority: 'omniroute',
      providerManagement: capabilitySupported(r, 'provider-management') || capabilitySupported(r, 'provider-connections-write'),
      modelManagement: capabilitySupported(r, 'model-management') || capabilitySupported(r, 'models-write'),
      routingRulesManagement: capabilitySupported(r, 'routing-rules-write'),
      promptFirewall: capabilitySupported(r, 'prompt-firewall'),
      gatewayAuthentication: capabilitySupported(r, 'gateway-authentication') || true,
      perKeyRateLimiting: capabilitySupported(r, 'per-key-rate-limiting') || true,
      originValidation: capabilitySupported(r, 'origin-validation') || true,
      requestTelemetry: 'd1-edge',
      providerInventorySource: capabilitySupported(r, 'provider-inventory-live') ? 'legacy-read-model' : 'legacy-read-model',
      modelInventorySource: capabilitySupported(r, 'model-inventory-live') ? 'legacy-read-model' : 'legacy-read-model',
      securityEventSource: 'd1-observed-events',
      adminAuthSource: 'd1-hashed-admin-keys',
      environment: String(asRecord(r.environment).id ?? r.environmentId ?? ''),
    };
  }
  return r as unknown as OperationalCapabilities;
}

function normalizeOmniRouteStatus(row: unknown): OmniRouteStatus | null {
  const data = asRecord(envelopeData(row));
  const r = asRecord(data.omniroute ?? data);
  if (!Object.keys(r).length) return null;
  return {
    configured: Boolean(r.configured), reachable: r.reachable === null || r.reachable === undefined ? null : Boolean(r.reachable),
    checkedAt: asNumber(r.checkedAt, 0), originHost: r.originHost ? String(r.originHost) : null, probePath: '/v1/models',
    httpStatus: asOptionalNumber(r.httpStatus), latencyMs: asOptionalNumber(r.latencyMs), modelCount: asOptionalNumber(r.modelCount),
    modelIds: asStringArray(r.modelIds), error: r.error ? String(r.error) : null,
  };
}

function normalizeAlerts(rows: unknown): OperationalAlert[] | null {
  if (!Array.isArray(rows)) return null;
  return rows.map((item, index) => {
    const alert = asRecord(item);
    const severity = String(alert.severity ?? 'medium').toLowerCase();
    return {
      id: String(alert.id ?? `alert-${index}`), severity: severity === 'critical' || severity === 'high' || severity === 'low' ? severity : 'medium',
      type: String(alert.type ?? 'operational_alert'), title: String(alert.title ?? 'Operational alert'), detail: String(alert.detail ?? ''),
      timestamp: asNumber(alert.timestamp, 0), actionPath: alert.actionPath ? String(alert.actionPath) : undefined,
      actionLabel: alert.actionLabel ? String(alert.actionLabel) : undefined, source: alert.source ? String(alert.source) : undefined,
    };
  });
}

function normalizeHistory(rows: unknown): RoutingDecision[] {
  const items = Array.isArray(rows) ? rows : envelopeItems(rows);
  return items.map((item) => {
    const r = asRecord(item);
    const reasons = Array.isArray(r.reasons) ? r.reasons.join(', ') : String(r.reasons ?? r.routingReason ?? 'No routing reason recorded');
    return {
      id: String(r.id ?? r.requestId ?? ''), timestamp: asNumber(r.timestamp ?? r.observedAt, 0), requestType: String(r.requestType ?? 'api'),
      selectedModel: String(r.selectedModel ?? r.requestedModel ?? r.modelName ?? 'Unknown'),
      providerId: r.providerId ? String(r.providerId) : r.selectedProviderId ? String(r.selectedProviderId) : undefined,
      routingReason: reasons, latency: asNumber(r.latency ?? r.latencyMs ?? r.durationMs, 0), cost: asOptionalNumber(r.cost),
    };
  });
}

function normalizeEvents(rows: unknown): SecurityEvent[] {
  return Array.isArray(rows) ? rows.map((item) => {
    const e = asRecord(item); const severity = String(e.severity ?? 'medium').toLowerCase(); const action = String(e.action ?? 'Logged').toUpperCase();
    return {
      id: String(e.id ?? ''), timestamp: asNumber(e.timestamp, 0), eventType: String(e.eventType ?? e.event_type ?? 'security_event'),
      severity: severity === 'critical' ? 'Critical' : severity === 'high' ? 'High' : severity === 'low' ? 'Low' : 'Medium',
      sourceIp: e.sourceIp ? String(e.sourceIp) : e.source ? String(e.source) : undefined,
      action: action === 'BLOCK' || action === 'BLOCKED' ? 'Blocked' : action === 'ALLOW' || action === 'ALLOWED' ? 'Allowed' : 'Logged',
      details: e.detail ? String(e.detail) : undefined,
    };
  }) : [];
}

async function safeJson(path: string, fallback: unknown): Promise<unknown> {
  try {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

async function safeV2(path: string, fallback: unknown): Promise<unknown> {
  return envelopeData(await safeJson(path, fallback));
}

function useDashboardData(): DashboardData {
  const [data, setData] = useState<Omit<DashboardData, 'refetch'>>({
    stats: null, analytics: null, topology: null, history: [], securityEvents: [], providers: [], models: [], runtime: null,
    readiness: null, capabilities: null, omniRouteStatus: null, alerts: null, loading: true,
  });

  const fetchData = async () => {
    setData((prev) => ({ ...prev, loading: true }));
    const [
      stats, richAnalytics, v2Analytics, topology, richHistory, v2History, events, providerHealth, providerCatalog, models,
      runtime, readiness, alerts, capabilities, omniRouteStatus,
    ] = await Promise.all([
      safeJson('/api/dashboard/stats', null),
      safeJson('/api/analytics?hours=24', null),
      safeV2('/api/v2/observability/metrics', null),
      safeJson('/api/topology', null),
      safeJson('/api/routing/history?limit=100', null),
      safeJson('/api/v2/observability/requests?limit=100', []),
      safeJson('/api/security/events', []),
      safeJson('/api/providers/health', null),
      safeJson('/api/v2/providers?limit=200', []),
      safeJson('/api/v2/models?limit=200', []),
      safeJson('/api/runtime', null),
      safeJson('/api/readiness', null),
      safeJson('/api/alerts', null),
      safeV2('/api/v2/system/capabilities', null),
      safeV2('/api/v2/system/status', null),
    ]);
    const providerRows = Array.isArray(providerHealth) ? providerHealth : envelopeItems(providerCatalog);
    const historyRows = Array.isArray(richHistory) ? richHistory : v2History;
    setData({
      stats: normalizeStats(stats),
      analytics: mergeAnalyticsSources(normalizeAnalytics(richAnalytics), normalizeAnalytics(v2Analytics)),
      topology: topology as TopologyData | null,
      history: normalizeHistory(historyRows), securityEvents: normalizeEvents(events),
      providers: providerRows.map(normalizeProvider), models: envelopeItems(models).map(normalizeModel),
      runtime: normalizeRuntime(runtime), readiness: normalizeReadiness(readiness), alerts: normalizeAlerts(alerts),
      capabilities: normalizeCapabilities(capabilities), omniRouteStatus: normalizeOmniRouteStatus(omniRouteStatus), loading: false,
    });
  };

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 15000);
    return () => clearInterval(interval);
  }, []);

  return { ...data, refetch: fetchData };
}

function DashboardLayout() {
  const data = useDashboardData();
  return (
    <AppShell onRefresh={data.refetch} isRefreshing={data.loading} readiness={data.readiness} alerts={data.alerts} observedRequests={data.stats?.totalRequests ?? 0} omniRouteStatus={data.omniRouteStatus} environment={data.capabilities?.environment ?? null}>
      <Routes>
        <Route path="/" element={<DashboardView data={data} />} />
        <Route path="/topology" element={<TopologyView data={data} />} />
        <Route path="/providers" element={<ProvidersSection data={data} />} />
        <Route path="/models" element={<Models data={data} />} />
        <Route path="/routing" element={<RoutingRulesView data={data} />} />
        <Route path="/keys" element={<ApiKeysView data={data} />} />
        <Route path="/policies" element={<SecurityPoliciesView data={data} />} />
        <Route path="/firewall" element={<FirewallView data={data} />} />
        <Route path="/logs" element={<LogsView />} />
        <Route path="/analytics" element={<AnalyticsView data={data} />} />
        <Route path="/alerts" element={<AlertsView data={data} />} />
        <Route path="/metrics" element={<MetricsView data={data} />} />
        <Route path="/traces" element={<TracesView />} />
        <Route path="/audit" element={<AuditLogView />} />
        <Route path="/settings" element={<SettingsView data={data} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/signin" element={<AnonymousOnlyRoute><DreamWorkerAuthScreen /></AnonymousOnlyRoute>} />
          <Route path="/connecting" element={<ProtectedRoute><DreamWorkerLoadingScreen /></ProtectedRoute>} />
          <Route path="/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
