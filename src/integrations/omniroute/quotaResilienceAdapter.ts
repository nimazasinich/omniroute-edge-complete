import { validateOmniRouteOrigin } from '../../edge/gatewayCore';
import type {
  AdapterReadResult, ConnectionCooldownState, DataProvenance, ModelLockoutState,
  ProviderCircuitBreakerState, QuotaObservation, QuotaPlan, ResilienceState,
} from '../../domain/platform';

export interface OmniRouteQuotaResilienceAdapter {
  listQuotas(): Promise<AdapterReadResult<QuotaObservation[]>>;
  getResilience(): Promise<AdapterReadResult<ResilienceState>>;
  listQuotaPlans(): Promise<AdapterReadResult<QuotaPlan[]>>;
}

export interface OmniRouteQuotaResilienceAdapterConfig {
  origin?: string;
  originToken?: string;
  environmentId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export class HttpOmniRouteQuotaResilienceAdapter implements OmniRouteQuotaResilienceAdapter {
  constructor(private readonly config: OmniRouteQuotaResilienceAdapterConfig) {}

  async listQuotas(): Promise<AdapterReadResult<QuotaObservation[]>> {
    const health = await this.readHealth();
    if (health.status !== 'ok') return health;
    const quotaMonitor = record(health.payload.quotaMonitor);
    if (!quotaMonitor || !Array.isArray(quotaMonitor.monitors)) return unavailable(health.httpStatus, 'invalid_quota_monitor_schema');
    const data = quotaMonitor.monitors.flatMap(normalizeQuota);
    return { status: 'ok', data, provenance: health.provenance };
  }

  async getResilience(): Promise<AdapterReadResult<ResilienceState>> {
    const health = await this.readHealth();
    if (health.status !== 'ok') return health;
    const lockouts = normalizeLockouts(health.payload.lockouts);
    if (!Array.isArray(health.payload.providerBreakers) || !record(health.payload.connectionHealth) || lockouts === null) {
      return unavailable(health.httpStatus, 'invalid_resilience_schema');
    }
    const data: ResilienceState = {
      providerBreakers: health.payload.providerBreakers.flatMap(normalizeBreaker),
      connectionCooldowns: Object.entries(health.payload.connectionHealth).flatMap(normalizeCooldown),
      modelLockouts: lockouts,
      connectionFallback: { supported: false, reason: 'not-exposed' },
      comboFallback: { supported: false, reason: 'not-exposed' },
      provenance: health.provenance,
    };
    return { status: 'ok', data, provenance: health.provenance };
  }

  async listQuotaPlans(): Promise<AdapterReadResult<QuotaPlan[]>> {
    const response = await this.fetchJson('/api/quota/plans');
    if (response.status !== 'ok') return response;
    const plans = Array.isArray(response.payload.plans) ? response.payload.plans.flatMap(normalizeQuotaPlan) : null;
    if (!plans) return unavailable(response.httpStatus, 'invalid_quota_plans_schema');
    return { status: 'ok', data: plans, provenance: response.provenance };
  }

  private async readHealth(): Promise<
    | { status: 'ok'; payload: Record<string, unknown>; provenance: DataProvenance; httpStatus: number }
    | { status: 'unavailable'; httpStatus: number | null; reason: string }
  > {
    return this.fetchJson('/api/monitoring/health');
  }

  private async fetchJson(path: string): Promise<
    | { status: 'ok'; payload: Record<string, unknown>; provenance: DataProvenance; httpStatus: number }
    | { status: 'unavailable'; httpStatus: number | null; reason: string }
  > {
    const validation = validateOmniRouteOrigin(this.config.origin);
    if (!validation.ok) return unavailable(null, `origin_${validation.reason}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
    try {
      const headers = new Headers({ Accept: 'application/json' });
      if (this.config.originToken?.trim()) headers.set('Authorization', `Bearer ${this.config.originToken.trim()}`);
      const response = await (this.config.fetchImpl ?? fetch)(new URL(path, validation.origin), {
        method: 'GET', headers, redirect: 'manual', signal: controller.signal,
      });
      if (!response.ok) return unavailable(response.status, `upstream_http_${response.status}`);
      const payload = record(await response.json().catch(() => null));
      if (!payload) return unavailable(response.status, 'invalid_health_schema');
      const observedAt = (this.config.now ?? Date.now)();
      return { status: 'ok', payload, httpStatus: response.status, provenance: {
        source: 'omniroute', authoritative: true, observedAt, environmentId: this.config.environmentId,
      } };
    } catch (error) {
      const reason = error instanceof Error ? (error.name === 'AbortError' ? 'probe_timeout' : error.message) : String(error);
      return unavailable(null, reason);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeQuota(raw: unknown): QuotaObservation[] {
  const value = record(raw);
  const providerId = text(value?.provider);
  const accountId = text(value?.accountId);
  const status = text(value?.status);
  if (!value || !providerId || !accountId || !status) return [];
  return [{
    providerId, accountId, status,
    observedAt: timestamp(value.lastSuccessAt ?? value.lastPolledAt),
    resetAt: timestamp(value.lastResetAt),
    remainingPercent: numberOrNull(value.lastQuotaPercent),
    used: numberOrNull(value.lastQuotaUsed),
    limit: numberOrNull(value.lastQuotaTotal),
  }];
}

function normalizeBreaker(raw: unknown): ProviderCircuitBreakerState[] {
  const value = record(raw);
  const providerId = text(value?.provider);
  const state = text(value?.state);
  return value && providerId && state ? [{ providerId, state, failureCount: numberOrNull(value.failureCount),
    lastFailureAt: timestamp(value.lastFailure), retryAfterMs: numberOrNull(value.retryAfterMs) }] : [];
}

function normalizeCooldown([providerId, raw]: [string, unknown]): ConnectionCooldownState[] {
  const value = record(raw);
  const coolingDown = integer(value?.coolingDown);
  const total = integer(value?.total);
  const soonestRetryAfterMs = integer(value?.soonestRetryAfterMs);
  return value && providerId && coolingDown !== null && total !== null && soonestRetryAfterMs !== null
    ? [{ providerId, coolingDown, total, soonestRetryAfterMs }] : [];
}

function normalizeLockout([modelReference, raw]: [string, unknown]): ModelLockoutState[] {
  const value = record(raw);
  if (!value || !modelReference) return [];
  return [{ modelReference, reason: text(value.reason), until: timestamp(value.until), lockedAt: timestamp(value.lockedAt),
    failureCount: numberOrNull(value.failureCount), lastFailureAt: timestamp(value.lastFailureAt), resetAfterMs: numberOrNull(value.resetAfterMs) }];
}

function normalizeLockouts(raw: unknown): ModelLockoutState[] | null {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => {
      const value = record(entry);
      const modelReference = text(value?.model);
      if (!value || !modelReference) return [];
      return [{ modelReference, reason: text(value.reason), until: null, lockedAt: null,
        failureCount: null, lastFailureAt: null, resetAfterMs: numberOrNull(value.remainingMs) }];
    });
  }
  const value = record(raw);
  return value ? Object.entries(value).flatMap(normalizeLockout) : null;
}

function normalizeQuotaPlan(raw: unknown): QuotaPlan[] {
  const value = record(raw);
  const providerId = text(value?.provider);
  const source = text(value?.source);
  if (!value || !providerId || !source || !Array.isArray(value.dimensions)) return [];
  const dimensions = value.dimensions.flatMap((rawDimension) => {
    const dimension = record(rawDimension);
    const unit = text(dimension?.unit); const window = text(dimension?.window);
    const limit = numberOrNull(dimension?.limit);
    return dimension && unit && window && limit !== null ? [{ unit, window, limit }] : [];
  });
  if (dimensions.length !== value.dimensions.length) return [];
  return [{ providerId, connectionId: text(value.connectionId), source, dimensions,
    remaining: { supported: false, reason: 'not-exposed' } }];
}

function record(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function numberOrNull(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function integer(value: unknown): number | null { return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null; }
function timestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null;
}
function unavailable(httpStatus: number | null, reason: string) { return { status: 'unavailable' as const, httpStatus, reason }; }
