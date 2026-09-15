import type {
  CapabilityDescriptor,
  CapabilityRegistry,
  EnvironmentIdentity,
  OmniRouteRuntimeInfo,
  SourceDiagnostic,
  SystemStatus,
} from '../domain/platform';

export function getEnvironmentIdentity(raw: string | undefined, omniroute?: OmniRouteRuntimeInfo): EnvironmentIdentity {
  const id = raw?.trim() || 'local';
  const label = id === 'local' ? 'Local' : id;
  const mode: EnvironmentIdentity['mode'] = omniroute?.reachable === true
    ? 'live'
    : omniroute?.configured
      ? 'degraded'
      : 'snapshot';
  return { id, label, mode };
}

export function buildSystemStatus(environment: EnvironmentIdentity, omniroute: OmniRouteRuntimeInfo): SystemStatus {
  return {
    environment,
    routingAuthority: 'omniroute',
    controlPlane: {
      available: true,
      apiVersion: 'v2',
    },
    omniroute,
  };
}

export function buildCapabilityRegistry(environment: EnvironmentIdentity, omniroute: OmniRouteRuntimeInfo): CapabilityRegistry {
  const omnirouteReadable = omniroute.reachable === true;
  const providerManagementReadable = omniroute.capabilities.includes('management.providers.read');
  const notConnectedReason = omniroute.configured
    ? (omniroute.error ?? 'OmniRoute management surface is unavailable')
    : 'OMNIROUTE_ORIGIN is not configured';

  const capabilities: CapabilityDescriptor[] = [
    {
      id: 'system.status',
      label: 'System status',
      supported: true,
      read: true,
      write: false,
      source: 'control-api',
    },
    {
      id: 'system.capabilities',
      label: 'Capability registry',
      supported: true,
      read: true,
      write: false,
      source: 'control-api',
    },
    {
      id: 'system.sources',
      label: 'Source diagnostics',
      supported: true,
      read: true,
      write: false,
      source: 'control-api',
    },
    {
      id: 'system.environment',
      label: 'Environment identity',
      supported: true,
      read: true,
      write: false,
      source: 'control-api',
    },
    {
      id: 'omniroute.runtime',
      label: 'OmniRoute runtime probe',
      supported: omniroute.configured,
      read: omniroute.configured,
      write: false,
      source: 'omniroute',
      reason: omniroute.configured ? undefined : notConnectedReason,
    },
    {
      id: 'providers.read',
      label: 'Provider connections',
      supported: providerManagementReadable,
      read: providerManagementReadable,
      write: false,
      source: 'omniroute',
      reason: providerManagementReadable
        ? undefined
        : omnirouteReadable
          ? 'OmniRoute provider-management read access was not observed'
          : notConnectedReason,
      requires: ['omniroute.runtime'],
    },
    {
      id: 'models.read',
      label: 'Model catalog',
      supported: omnirouteReadable,
      read: omnirouteReadable,
      write: false,
      source: 'omniroute',
      reason: omnirouteReadable ? undefined : notConnectedReason,
      requires: ['omniroute.runtime'],
    },
    {
      id: 'combos.read',
      label: 'Combo catalog',
      supported: omniroute.capabilities.includes('management.combos.read'),
      read: omniroute.capabilities.includes('management.combos.read'),
      write: false,
      source: 'omniroute',
      reason: omniroute.capabilities.includes('management.combos.read')
        ? undefined
        : 'OmniRoute Combo management read access was not observed',
      requires: ['omniroute.runtime'],
      documented: true,
      runtimeVerified: omniroute.capabilities.includes('management.combos.read'),
    },
    {
      id: 'combos.write',
      label: 'Combo mutations',
      supported: false,
      read: false,
      write: false,
      source: 'omniroute',
      reason: 'OmniRoute Combo mutation contract and concurrency behavior are not runtime-verified',
      requires: ['combos.read'],
      documented: true,
      runtimeVerified: false,
    },
    {
      id: 'routing.outcomes.read',
      label: 'Persisted OmniRoute routing outcomes',
      supported: false,
      read: false,
      write: false,
      source: 'omniroute',
      reason: 'The documented call-log surface has not been verified against the configured runtime',
      documented: true,
      runtimeVerified: false,
    },
    {
      id: 'routing.decisions.detail',
      label: 'Exact routing decision detail',
      supported: false,
      read: false,
      write: false,
      source: 'omniroute',
      reason: 'A request-specific routing decision response has not been runtime-verified',
      documented: true,
      runtimeVerified: false,
    },
    {
      id: 'autoCombo.inspect',
      label: 'Auto Combo candidate inspection',
      supported: false,
      read: false,
      write: false,
      source: 'omniroute',
      reason: 'The documented Auto Combo candidate surface has not been verified against the configured runtime',
      documented: true,
      runtimeVerified: false,
    },
    {
      id: 'quota.read', label: 'Provider and connection quota observations', supported: false, read: false, write: false,
      source: 'omniroute', reason: 'The documented monitoring health quota observations have not been runtime-verified',
      documented: true, runtimeVerified: false,
    },
    {
      id: 'resilience.read', label: 'OmniRoute resilience state', supported: false, read: false, write: false,
      source: 'omniroute', reason: 'The documented breaker, cooldown, and lockout surfaces have not been runtime-verified',
      documented: true, runtimeVerified: false,
    },
    {
      id: 'observability.requests.read', label: 'Durable edge request index', supported: true, read: true, write: false,
      source: 'd1', reason: 'Observation read model only; not routing authority', documented: true, runtimeVerified: true,
    },
    {
      id: 'observability.providerAttempts.read', label: 'Observed provider attempt index', supported: false, read: false, write: false,
      source: 'omniroute', reason: 'Exact OmniRoute provider-attempt ingestion is not configured', documented: true, runtimeVerified: false,
    },
    {
      id: 'observability.routingDecisionIndex.read', label: 'Durable OmniRoute outcome index',
      supported: true, read: true, write: false, source: 'd1',
      reason: 'Contains only explicitly ingested persisted OmniRoute call-log outcomes', documented: true, runtimeVerified: true,
    },
    {
      id: 'analyticsEngine.read', label: 'Workers Analytics Engine metrics', supported: false, read: false, write: false,
      source: 'cloudflare-analytics', reason: 'Analytics Engine binding and query surface are not configured', documented: true, runtimeVerified: false,
    },
    {
      id: 'telemetry.webhooks.ingest', label: 'OmniRoute webhook telemetry ingestion', supported: false, read: false, write: false,
      source: 'omniroute', reason: 'v3.8.51 has signed webhook transport but no verified production request-event emitter payload contract',
      documented: true, runtimeVerified: false,
    },
    {
      id: 'providers.snapshot.read',
      label: 'Local provider snapshot',
      supported: true,
      read: true,
      write: false,
      source: 'local-snapshot',
      reason: 'Historical inventory only; not live health or routing authority',
    },
    {
      id: 'edge.inference.forward',
      label: 'Edge inference forwarding',
      supported: true,
      read: true,
      write: false,
      source: 'cloudflare-worker',
    },
  ];

  return {
    generatedAt: Date.now(),
    environmentId: environment.id,
    routingAuthority: 'omniroute',
    environment,
    capabilities,
  };
}

export function buildSourceDiagnostics(environment: EnvironmentIdentity, omniroute: OmniRouteRuntimeInfo): SourceDiagnostic[] {
  const observedAt = Date.now();
  return [
    {
      id: 'omniroute-runtime',
      label: 'OmniRoute runtime',
      source: 'omniroute',
      configured: omniroute.configured,
      reachable: omniroute.reachable,
      authoritativeFor: omniroute.reachable === true
        ? ['provider routing', 'model execution', 'fallback', 'runtime models']
        : ['provider routing', 'model execution', 'fallback'],
      provenance: omniroute.provenance,
      warnings: omniroute.provenance.warnings ?? [],
    },
    {
      id: 'local-snapshot',
      label: 'Local SQLite snapshot',
      source: 'local-snapshot',
      configured: true,
      reachable: true,
      authoritativeFor: ['historical provider inventory', 'historical model inventory'],
      provenance: {
        source: 'local-snapshot',
        authoritative: false,
        observedAt,
        environmentId: environment.id,
        warnings: ['Snapshot data is not live OmniRoute health.'],
      },
      warnings: ['Snapshot data must not be used as routing authority.'],
    },
    {
      id: 'd1-read-model',
      label: 'D1 durable read model',
      source: 'd1',
      configured: true,
      reachable: true,
      authoritativeFor: ['gateway request observations', 'admin metadata'],
      provenance: {
        source: 'd1',
        authoritative: false,
        observedAt,
        environmentId: environment.id,
      },
      warnings: [],
    },
    {
      id: 'cloudflare-worker',
      label: 'Cloudflare Worker edge',
      source: 'cloudflare-worker',
      configured: true,
      reachable: null,
      authoritativeFor: ['public transport', 'gateway authentication', 'edge request telemetry'],
      provenance: {
        source: 'cloudflare-worker',
        authoritative: true,
        observedAt,
        environmentId: environment.id,
      },
      warnings: [],
    },
  ];
}
