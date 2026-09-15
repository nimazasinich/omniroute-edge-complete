import type { AdapterReadResult, RoutingOutcome } from '../domain/platform';
import type { OmniRouteTelemetryAdapter } from '../integrations/omniroute/telemetryAdapter';
import { RoutingDecisionIndexRepository } from '../repositories/routingDecisionIndexRepository';
import { HttpOmniRouteTelemetryAdapter } from '../integrations/omniroute/telemetryAdapter';
import type { AppBindings } from '../server/app';
import { getEnvironmentIdentity } from './capabilityService';

export interface OmniRouteTelemetryIngestionSource {
  readPersistedOutcomes(): Promise<AdapterReadResult<RoutingOutcome[]>>;
}

export class AdapterTelemetryIngestionSource implements OmniRouteTelemetryIngestionSource {
  constructor(private readonly adapter: OmniRouteTelemetryAdapter) {}
  readPersistedOutcomes() { return this.adapter.listRoutingOutcomes(); }
}

export class TelemetryIngestionService {
  constructor(private readonly source: OmniRouteTelemetryIngestionSource, private readonly decisions: RoutingDecisionIndexRepository) {}

  async ingestPersistedOutcomes() {
    const result = await this.source.readPersistedOutcomes();
    if (result.status !== 'ok') return result;
    const persisted = await this.decisions.ingest(result.data);
    return { status: 'ok' as const, data: { ...persisted, sourceRecords: result.data.length }, provenance: result.provenance };
  }
}

export function createTelemetryIngestionService(env: AppBindings) {
  const environment = getEnvironmentIdentity(env?.ENVIRONMENT);
  const adapter = new HttpOmniRouteTelemetryAdapter({
    origin: env?.OMNIROUTE_ORIGIN, originToken: env?.OMNIROUTE_ORIGIN_TOKEN, environmentId: environment.id,
  });
  return {
    environmentId: environment.id,
    service: new TelemetryIngestionService(
      new AdapterTelemetryIngestionSource(adapter),
      new RoutingDecisionIndexRepository(env.db, environment.id),
    ),
  };
}
