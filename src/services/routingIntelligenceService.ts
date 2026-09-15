import type { AppBindings } from '../server/app';
import { HttpOmniRouteTelemetryAdapter } from '../integrations/omniroute/telemetryAdapter';
import type { OmniRouteTelemetryAdapter } from '../integrations/omniroute/telemetryAdapter';
import { getEnvironmentIdentity } from './capabilityService';

export class RoutingIntelligenceService {
  constructor(private readonly telemetry: OmniRouteTelemetryAdapter) {}

  listDecisions() {
    return this.telemetry.listRoutingOutcomes();
  }

  getDecision(requestId: string) {
    return this.telemetry.getRoutingDecision(requestId);
  }

  inspectAutoCombo(channel: string) {
    return this.telemetry.inspectAutoCombo(channel);
  }

  getExplainabilitySnapshot() {
    return this.telemetry.getExplainabilitySnapshot();
  }
}

export function createRoutingIntelligenceService(env: AppBindings) {
  const environment = getEnvironmentIdentity(env?.ENVIRONMENT);
  const adapter = new HttpOmniRouteTelemetryAdapter({
    origin: env?.OMNIROUTE_ORIGIN,
    originToken: env?.OMNIROUTE_ORIGIN_TOKEN,
    environmentId: environment.id,
  });
  return { environmentId: environment.id, service: new RoutingIntelligenceService(adapter) };
}
