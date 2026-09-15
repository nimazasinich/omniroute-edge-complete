import type { RequestTrace, TraceStage } from '../domain/platform';
import { HttpOmniRouteTelemetryAdapter } from '../integrations/omniroute/telemetryAdapter';
import { RequestReadModelRepository } from '../repositories/requestReadModelRepository';
import { RoutingDecisionIndexRepository } from '../repositories/routingDecisionIndexRepository';
import type { AppBindings } from '../server/app';
import { getEnvironmentIdentity } from './capabilityService';

export class ObservabilityService {
  constructor(private readonly requests: RequestReadModelRepository, private readonly telemetry: HttpOmniRouteTelemetryAdapter,
    private readonly decisions: RoutingDecisionIndexRepository) {}
  listRequests(input: { limit: number; offset: number; correlationId?: string }) { return this.requests.list(input); }
  metrics(since: number) { return this.requests.metrics(since); }
  listIndexedDecisions(limit: number) { return this.decisions.list(limit); }

  async getTrace(requestId: string): Promise<RequestTrace | null> {
    const edge = await this.requests.get(requestId);
    if (!edge.item) return null;
    const [indexedOutcome, decision] = await Promise.all([
      this.decisions.getOutcome(requestId), this.telemetry.getRoutingDecision(requestId),
    ]);
    const decisionStage: TraceStage = decision.status === 'ok'
      ? { stage: 'omniroute-decision', status: 'exposed', data: decision.data }
      : { stage: 'omniroute-decision', status: 'unavailable', data: null, reason: decision.status === 'unavailable' ? decision.reason : 'not-found' };
    return {
      requestId, correlationId: edge.item.correlationId,
      stages: [
        { stage: 'edge-request', status: 'observed', data: edge.item },
        ...(indexedOutcome ? [{ stage: 'omniroute-outcome' as const, status: 'observed' as const, data: indexedOutcome }] : []),
        decisionStage,
        { stage: 'provider-attempts', status: 'unavailable', data: null, reason: 'No exact OmniRoute attempt ingestion is configured.' },
      ],
      complete: Boolean(indexedOutcome) && decision.status === 'ok',
      provenance: [edge.provenance, ...(indexedOutcome ? [indexedOutcome.provenance] : []),
        ...(decision.status === 'ok' ? [decision.provenance] : [])],
    };
  }
}

export function createObservabilityService(env: AppBindings) {
  const environment = getEnvironmentIdentity(env?.ENVIRONMENT);
  return new ObservabilityService(
    new RequestReadModelRepository(env.db, environment.id),
    new HttpOmniRouteTelemetryAdapter({ origin: env?.OMNIROUTE_ORIGIN, originToken: env?.OMNIROUTE_ORIGIN_TOKEN, environmentId: environment.id }),
    new RoutingDecisionIndexRepository(env.db, environment.id),
  );
}
