import { validateOmniRouteOrigin } from '../../edge/gatewayCore';
import type { CatalogResult, Combo, ComboTarget, DataProvenance, ModelDefinition, OmniRouteRuntimeInfo, ProviderConnection } from '../../domain/platform';

export interface OmniRouteManagementAdapter {
  getRuntimeInfo(): Promise<OmniRouteRuntimeInfo>;
  listProviderConnections(): Promise<CatalogResult<ProviderConnection> | null>;
  listModels(): Promise<CatalogResult<ModelDefinition> | null>;
  listCombos(): Promise<CatalogResult<Combo> | null>;
}

export interface OmniRouteManagementAdapterConfig {
  origin?: string;
  originToken?: string;
  environmentId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export class HttpOmniRouteManagementAdapter implements OmniRouteManagementAdapter {
  constructor(private readonly config: OmniRouteManagementAdapterConfig) {}

  async getRuntimeInfo(): Promise<OmniRouteRuntimeInfo> {
    const now = this.config.now ?? Date.now;
    const observedAt = now();
    const validation = validateOmniRouteOrigin(this.config.origin);

    if (!validation.ok) {
      return this.unavailableInfo(observedAt, null, `origin_${validation.reason}`, validation.reason === 'missing');
    }

    const target = new URL('/v1/models', validation.origin);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
    const startedAt = now();

    try {
      const headers = new Headers({ Accept: 'application/json' });
      if (this.config.originToken?.trim()) {
        headers.set('Authorization', `Bearer ${this.config.originToken.trim()}`);
      }

      const response = await (this.config.fetchImpl ?? fetch)(target, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
      const latencyMs = Math.max(0, now() - startedAt);
      const payload = response.ok ? await readModelsPayload(response) : null;
      const modelIds = payload?.modelIds ?? [];
      const version = firstNonEmptyString(
        response.headers.get('x-omniroute-version'),
        response.headers.get('x-api-version'),
        payload?.version,
      );
      const build = firstNonEmptyString(
        response.headers.get('x-omniroute-build'),
        response.headers.get('x-build-id'),
        payload?.build,
      );
      const [providerReadSupported, comboReadSupported] = response.ok
        ? await Promise.all([this.probeProviderRead(), this.probeComboRead()])
        : [false, false];
      const warnings = response.ok ? undefined : [`OmniRoute /v1/models returned HTTP ${response.status}`];
      const capabilities = response.ok ? ['inference.models'] : [];
      const apiVariants = response.ok ? ['/v1/models'] : [];
      if (providerReadSupported) {
        capabilities.push('management.providers.read');
        apiVariants.push('/api/providers');
      }
      if (comboReadSupported) {
        capabilities.push('management.combos.read');
        apiVariants.push('/api/combos');
      }

      return {
        configured: true,
        reachable: response.ok,
        version,
        build,
        capabilities,
        apiVariants,
        probePath: '/v1/models',
        originHost: validation.origin.host,
        httpStatus: response.status,
        latencyMs,
        modelCount: response.ok ? modelIds.length : null,
        error: response.ok ? null : `probe_http_${response.status}`,
        provenance: provenance('omniroute', response.ok, observedAt, this.config.environmentId, warnings),
      };
    } catch (error) {
      const message = error instanceof Error
        ? (error.name === 'AbortError' ? 'probe_timeout' : error.message)
        : String(error);
      return this.unavailableInfo(observedAt, validation.origin.host, message, false, Math.max(0, now() - startedAt));
    } finally {
      clearTimeout(timeout);
    }
  }

  async listProviderConnections(): Promise<CatalogResult<ProviderConnection> | null> {
    const now = this.config.now ?? Date.now;
    const observedAt = now();
    const validation = validateOmniRouteOrigin(this.config.origin);
    if (!validation.ok) return null;

    const response = await this.fetchPath(validation.origin, '/api/providers').catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as { connections?: unknown } | null;
    if (!Array.isArray(payload?.connections)) return null;

    const itemProvenance = provenance('omniroute', true, observedAt, this.config.environmentId);
    return {
      items: payload.connections.flatMap((raw) => normalizeProviderConnection(raw, itemProvenance)),
      provenance: itemProvenance,
    };
  }

  async listModels(): Promise<CatalogResult<ModelDefinition> | null> {
    const now = this.config.now ?? Date.now;
    const observedAt = now();
    const validation = validateOmniRouteOrigin(this.config.origin);
    if (!validation.ok) return null;

    const response = await this.fetchPath(validation.origin, '/v1/models').catch(() => null);
    if (!response?.ok) return null;

    const payload = await readModelsPayload(response);
    const itemProvenance = provenance('omniroute', true, observedAt, this.config.environmentId);
    return {
      items: payload.models.map((model) => ({
        id: model.id,
        providerId: model.providerId,
        displayName: model.displayName,
        capabilities: {},
        provenance: itemProvenance,
      })),
      provenance: itemProvenance,
    };
  }

  async listCombos(): Promise<CatalogResult<Combo> | null> {
    const now = this.config.now ?? Date.now;
    const observedAt = now();
    const validation = validateOmniRouteOrigin(this.config.origin);
    if (!validation.ok) return null;

    const response = await this.fetchPath(validation.origin, '/api/combos').catch(() => null);
    if (!response?.ok) return null;
    const payload = await response.json().catch(() => null) as { combos?: unknown } | null;
    if (!Array.isArray(payload?.combos)) return null;

    const itemProvenance = provenance('omniroute', true, observedAt, this.config.environmentId);
    return {
      items: payload.combos.flatMap((raw) => normalizeCombo(raw, itemProvenance)),
      provenance: itemProvenance,
    };
  }

  private async probeProviderRead(): Promise<boolean> {
    const validation = validateOmniRouteOrigin(this.config.origin);
    if (!validation.ok) return false;
    const response = await this.fetchPath(validation.origin, '/api/providers').catch(() => null);
    if (!response?.ok) return false;
    const payload = await response.json().catch(() => null) as { connections?: unknown } | null;
    return Array.isArray(payload?.connections);
  }

  private async probeComboRead(): Promise<boolean> {
    const validation = validateOmniRouteOrigin(this.config.origin);
    if (!validation.ok) return false;
    const response = await this.fetchPath(validation.origin, '/api/combos').catch(() => null);
    if (!response?.ok) return false;
    const payload = await response.json().catch(() => null) as { combos?: unknown } | null;
    return Array.isArray(payload?.combos);
  }

  private async fetchPath(origin: URL, path: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
    try {
      const headers = new Headers({ Accept: 'application/json' });
      if (this.config.originToken?.trim()) {
        headers.set('Authorization', `Bearer ${this.config.originToken.trim()}`);
      }
      return await (this.config.fetchImpl ?? fetch)(new URL(path, origin), {
        method: 'GET', headers, redirect: 'manual', signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private unavailableInfo(
    observedAt: number,
    originHost: string | null,
    error: string,
    notConfigured: boolean,
    latencyMs: number | null = null,
  ): OmniRouteRuntimeInfo {
    return {
      configured: !notConfigured,
      reachable: notConfigured ? null : false,
      version: null,
      build: null,
      capabilities: [],
      apiVariants: [],
      probePath: '/v1/models',
      originHost,
      httpStatus: null,
      latencyMs,
      modelCount: null,
      error,
      provenance: provenance('omniroute', false, observedAt, this.config.environmentId, [error]),
    };
  }
}

function normalizeProviderConnection(raw: unknown, itemProvenance: DataProvenance): ProviderConnection[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.id.trim()) return [];
  if (typeof item.provider !== 'string' || !item.provider.trim()) return [];
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.id.trim();
  return [{
    id: item.id.trim(),
    providerId: item.provider.trim(),
    name,
    enabled: item.isActive === true,
    authType: typeof item.authType === 'string' && item.authType.trim() ? item.authType.trim() : null,
    runtime: { health: 'unknown' },
    tags: [],
    provenance: itemProvenance,
  }];
}

function normalizeCombo(raw: unknown, itemProvenance: DataProvenance): Combo[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.id.trim()) return [];
  if (typeof item.name !== 'string' || !item.name.trim()) return [];
  const models = Array.isArray(item.models) ? item.models : [];
  const targets = models.map((target, index) => normalizeComboTarget(target, index));
  const config = isRecord(item.config) ? item.config : null;
  const auto = item.strategy === 'auto' ? {
    variant: stringValue(config?.variant),
    routerStrategy: stringValue(config?.routerStrategy),
    weights: numberRecord(config?.weights),
    candidatePool: stringArray(config?.candidatePool),
  } : undefined;
  return [{
    id: item.id.trim(),
    name: item.name.trim(),
    strategy: stringValue(item.strategy) ?? null,
    enabled: typeof item.isActive === 'boolean' ? item.isActive : null,
    targets,
    auto,
    revision: typeof item.updatedAt === 'string' || typeof item.updatedAt === 'number' ? String(item.updatedAt) : null,
    provenance: itemProvenance,
  }];
}

function normalizeComboTarget(raw: unknown, order: number): ComboTarget {
  if (typeof raw === 'string') {
    return { providerId: null, connectionId: null, modelId: raw, order };
  }
  if (!isRecord(raw)) {
    return { providerId: null, connectionId: null, modelId: null, order };
  }
  return {
    providerId: stringValue(raw.provider) ?? stringValue(raw.providerId) ?? null,
    connectionId: stringValue(raw.connectionId) ?? stringValue(raw.connection_id) ?? null,
    modelId: stringValue(raw.model) ?? stringValue(raw.modelId) ?? null,
    order,
    weight: numberValue(raw.weight),
    priority: numberValue(raw.priority),
    fallbackTier: numberValue(raw.fallbackTier) ?? numberValue(raw.fallback_tier),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.flatMap((item) => stringValue(item) ?? []);
  return values.length > 0 ? values : undefined;
}

function numberRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function provenance(
  source: DataProvenance['source'],
  authoritative: boolean,
  observedAt: number,
  environmentId: string,
  warnings?: string[],
): DataProvenance {
  return { source, authoritative, observedAt, environmentId, warnings };
}

interface ModelsProbePayload {
  data?: Array<{ id?: unknown; owned_by?: unknown; name?: unknown }>;
  version?: unknown;
  build?: unknown;
  meta?: { version?: unknown; build?: unknown };
}

async function readModelsPayload(response: Response): Promise<{
  modelIds: string[];
  models: Array<{ id: string; providerId: string | null; displayName?: string }>;
  version: string | null;
  build: string | null;
}> {
  const payload = await response.json().catch(() => null) as ModelsProbePayload | null;
  const models = Array.isArray(payload?.data) ? payload.data.flatMap((item) => {
    if (typeof item?.id !== 'string' || !item.id.trim()) return [];
    return [{
      id: item.id.trim(),
      providerId: typeof item.owned_by === 'string' && item.owned_by.trim() ? item.owned_by.trim() : null,
      displayName: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : undefined,
    }];
  }).slice(0, 1000) : [];
  return {
    modelIds: models.map((model) => model.id).slice(0, 100),
    models,
    version: firstNonEmptyString(payload?.version, payload?.meta?.version),
    build: firstNonEmptyString(payload?.build, payload?.meta?.build),
  };
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
