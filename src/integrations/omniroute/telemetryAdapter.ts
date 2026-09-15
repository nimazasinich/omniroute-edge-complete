import { validateOmniRouteOrigin } from '../../edge/gatewayCore';
import type {
  AdapterReadResult,
  AutoComboCandidate,
  AutoComboInspection,
  DataProvenance,
  RoutingDecisionDetail,
  RoutingExplainabilitySnapshot,
  RoutingOutcome,
} from '../../domain/platform';

export interface OmniRouteTelemetryAdapter {
  listRoutingOutcomes(): Promise<AdapterReadResult<RoutingOutcome[]>>;
  getRoutingDecision(requestId: string): Promise<AdapterReadResult<RoutingDecisionDetail>>;
  inspectAutoCombo(channel: string): Promise<AdapterReadResult<AutoComboInspection>>;
  getExplainabilitySnapshot(): Promise<AdapterReadResult<RoutingExplainabilitySnapshot>>;
}

export interface OmniRouteTelemetryAdapterConfig {
  origin?: string;
  originToken?: string;
  environmentId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export class HttpOmniRouteTelemetryAdapter implements OmniRouteTelemetryAdapter {
  constructor(private readonly config: OmniRouteTelemetryAdapterConfig) {}

  async listRoutingOutcomes(): Promise<AdapterReadResult<RoutingOutcome[]>> {
    const response = await this.fetchPath('/api/usage/call-logs?limit=200&offset=0');
    if (response.status !== 'ok') return response;
    const payload = await response.response.json().catch(() => null);
    if (!Array.isArray(payload)) return unavailable(response.response.status, 'invalid_call_logs_schema');
    const observedAt = (this.config.now ?? Date.now)();
    const itemProvenance = provenance(observedAt, this.config.environmentId);
    const rows = payload
      .filter((raw) => isRecord(raw) && raw.active !== true && raw.completed !== true)
      .flatMap((raw) => normalizeCallLog(raw, itemProvenance));
    return { status: 'ok', data: rows, provenance: itemProvenance };
  }

  async getRoutingDecision(requestId: string): Promise<AdapterReadResult<RoutingDecisionDetail>> {
    const response = await this.fetchPath(`/api/routing/decisions/${encodeURIComponent(requestId)}`);
    if (response.status === 'not-found') {
      const snapshot = await this.getExplainabilitySnapshot();
      return snapshot.status === 'ok'
        ? unavailable(404, 'request_specific_routing_decision_unavailable')
        : snapshot;
    }
    if (response.status !== 'ok') return response;
    const payload = await response.response.json().catch(() => null);
    const observedAt = (this.config.now ?? Date.now)();
    const itemProvenance = provenance(observedAt, this.config.environmentId);
    const detail = normalizeRoutingDecision(payload, itemProvenance);
    return detail
      ? { status: 'ok', data: detail, provenance: itemProvenance }
      : unavailable(response.response.status, 'invalid_routing_decision_schema');
  }

  async inspectAutoCombo(channel: string): Promise<AdapterReadResult<AutoComboInspection>> {
    const response = await this.fetchPath(`/api/v1/auto-combo/${encodeURIComponent(channel)}/candidates`);
    if (response.status === 'not-found') return unavailable(404, 'auto_combo_candidate_endpoint_unavailable');
    if (response.status !== 'ok') return response;
    const payload = await response.response.json().catch(() => null);
    if (!isRecord(payload) || typeof payload.channel !== 'string' || !Array.isArray(payload.candidates)) {
      return unavailable(response.response.status, 'invalid_auto_combo_schema');
    }
    const observedAt = (this.config.now ?? Date.now)();
    const itemProvenance = provenance(observedAt, this.config.environmentId);
    const candidates = payload.candidates.flatMap(normalizeAutoCandidate);
    const data: AutoComboInspection = {
      channel: payload.channel,
      candidates,
      dispatchPool: false,
      winner: { supported: false, reason: 'not-exposed' },
      warnings: ['Candidate inspection is an unfiltered transparency view, not the runtime dispatch pool or a predicted winner.'],
      provenance: itemProvenance,
    };
    return { status: 'ok', data, provenance: itemProvenance };
  }

  async getExplainabilitySnapshot(): Promise<AdapterReadResult<RoutingExplainabilitySnapshot>> {
    const response = await this.fetchPath('/api/v1/explain/routing');
    if (response.status !== 'ok') return response;
    const payload = await response.response.json().catch(() => null);
    if (!isRecord(payload) || payload.object !== 'routing_explain' || !Array.isArray(payload.sinks)
      || typeof payload.otelEnabled !== 'boolean' || !Array.isArray(payload.events) || !Array.isArray(payload.quality)) {
      return unavailable(response.response.status, 'invalid_routing_explainability_snapshot_schema');
    }
    const observedAt = (this.config.now ?? Date.now)();
    const itemProvenance = provenance(observedAt, this.config.environmentId);
    return { status: 'ok', data: {
      classification: 'omniroute-derived', object: 'routing_explain',
      sinks: payload.sinks.flatMap((value) => cleanString(value) ?? []),
      otelEnabled: payload.otelEnabled, events: payload.events, quality: payload.quality,
      otel: payload.otel ?? null, requestSpecific: false, provenance: itemProvenance,
    }, provenance: itemProvenance };
  }

  private async fetchPath(path: string): Promise<
    | { status: 'ok'; response: Response }
    | { status: 'not-found' }
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
      if (response.status === 404) return { status: 'not-found' };
      if (!response.ok) return unavailable(response.status, `upstream_http_${response.status}`);
      return { status: 'ok', response };
    } catch (error) {
      const reason = error instanceof Error
        ? error.name === 'AbortError' ? 'probe_timeout' : error.message
        : String(error);
      return unavailable(null, reason);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeCallLog(raw: unknown, itemProvenance: DataProvenance): RoutingOutcome[] {
  if (!isRecord(raw)) return [];
  const requestId = cleanString(raw.id);
  if (!requestId) return [];
  return [{
    requestId,
    correlationId: cleanString(raw.correlationId),
    observedAt: timestampValue(raw.timestamp),
    requestedModel: cleanString(raw.requestedModel),
    selected: {
      providerId: cleanString(raw.provider),
      connectionId: cleanString(raw.connectionId),
      modelId: cleanString(raw.model),
      comboId: cleanString(raw.comboName),
      comboStepId: cleanString(raw.comboStepId),
      comboExecutionKey: cleanString(raw.comboExecutionKey),
    },
    statusCode: positiveNumber(raw.status),
    durationMs: positiveNumber(raw.duration),
    strategy: null,
    reason: null,
    score: { supported: false, reason: 'not-exposed' },
    fallback: { supported: false, reason: 'not-exposed', attempts: [] },
    provenance: itemProvenance,
  }];
}

function normalizeRoutingDecision(raw: unknown, itemProvenance: DataProvenance): RoutingDecisionDetail | null {
  if (!isRecord(raw)) return null;
  const replay = isRecord(raw.decisionReplay) ? raw.decisionReplay : null;
  const runtime = replay && isRecord(replay.runtime) && replay.runtime.source === 'call_logs' && replay.runtime.exact === true
    ? replay.runtime
    : null;
  const request = isRecord(raw.request) ? raw.request : null;
  const requestId = cleanString(raw.requestId) ?? cleanString(request?.id) ?? cleanString(runtime?.selectedCallLogId);
  if (!requestId || !runtime) return null;
  return {
    requestId,
    correlationId: null,
    observedAt: timestampValue(runtime.timestamp),
    requestedModel: cleanString(request?.requestedModel),
    selected: {
      providerId: cleanString(runtime.provider),
      connectionId: cleanString(runtime.connectionId),
      modelId: cleanString(runtime.model),
      comboId: cleanString(runtime.comboName),
      comboStepId: cleanString(runtime.comboStepId),
      comboExecutionKey: cleanString(runtime.comboExecutionKey),
    },
    statusCode: positiveNumber(runtime.status),
    durationMs: positiveNumber(runtime.durationMs),
    strategy: null,
    reason: null,
    score: { supported: false, reason: 'not-exposed' },
    fallback: { supported: false, reason: 'not-exposed', attempts: [] },
    sourceRecord: 'omniroute-call-log',
    explainability: {
      classification: 'omniroute-derived',
      generatedAt: timestampValue(raw.generatedAt),
      routeType: cleanString(raw.routeType),
      confidence: cleanString(raw.confidence),
      summary: cleanString(raw.summary),
      score: finiteNumber(raw.score),
      factors: isRecord(raw.decision) && Array.isArray(raw.decision.factors) ? raw.decision.factors : [],
      warnings: [
        'Score and factors are generated by OmniRoute explainability and are not persisted routing facts.',
      ],
    },
    limitations: [
      'OmniRoute-derived explainability is separated from the exact persisted runtime record.',
      'Fallback relationships are not exposed without exact shared-attempt correlation evidence.',
      'Routing strategy is not present in the exact persisted runtime record.',
    ],
    provenance: itemProvenance,
  };
}

function normalizeAutoCandidate(raw: unknown): AutoComboCandidate[] {
  if (!isRecord(raw)) return [];
  const providerId = cleanString(raw.provider);
  const connectionId = cleanString(raw.connectionId);
  const modelId = cleanString(raw.model);
  const modelReference = cleanString(raw.modelStr);
  const breakerState = cleanString(raw.breakerState);
  if (!providerId || !connectionId || !modelId || !modelReference || !breakerState) return [];
  if (![raw.excluded, raw.reachable, raw.connectionCooldown, raw.modelLocked].every((value) => typeof value === 'boolean')) return [];
  return [{
    providerId, connectionId, modelId, modelReference,
    excluded: raw.excluded as boolean,
    reachable: raw.reachable as boolean,
    breakerState,
    connectionCooldown: raw.connectionCooldown as boolean,
    modelLocked: raw.modelLocked as boolean,
    freeAccessExclusion: cleanString(raw.freeAccessExclusion),
  }];
}

function provenance(observedAt: number, environmentId: string): DataProvenance {
  return { source: 'omniroute', authoritative: true, observedAt, environmentId };
}

function unavailable(httpStatus: number | null, reason: string) {
  return { status: 'unavailable' as const, httpStatus, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.trim() !== '-' ? value.trim() : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timestampValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
