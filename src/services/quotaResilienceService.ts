import type { AppBindings } from '../server/app';
import { HttpOmniRouteQuotaResilienceAdapter } from '../integrations/omniroute/quotaResilienceAdapter';
import type { OmniRouteQuotaResilienceAdapter } from '../integrations/omniroute/quotaResilienceAdapter';
import { getEnvironmentIdentity } from './capabilityService';

export class QuotaResilienceService {
  constructor(private readonly adapter: OmniRouteQuotaResilienceAdapter) {}
  listQuotas() { return this.adapter.listQuotas(); }
  getResilience() { return this.adapter.getResilience(); }
  listQuotaPlans() { return this.adapter.listQuotaPlans(); }
}

export function createQuotaResilienceService(env: AppBindings) {
  const environment = getEnvironmentIdentity(env?.ENVIRONMENT);
  const adapter = new HttpOmniRouteQuotaResilienceAdapter({
    origin: env?.OMNIROUTE_ORIGIN, originToken: env?.OMNIROUTE_ORIGIN_TOKEN, environmentId: environment.id,
  });
  return { environmentId: environment.id, service: new QuotaResilienceService(adapter) };
}
