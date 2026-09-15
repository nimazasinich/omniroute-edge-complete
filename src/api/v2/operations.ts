import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '../../server/app';
import { createQuotaResilienceService } from '../../services/quotaResilienceService';
import { errorEnvelope, getRequestId, okEnvelope } from './envelope';

export const operationsV2 = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

operationsV2.get('/quotas', async (c) => respond(c, 'quota'));
operationsV2.get('/resilience', async (c) => respond(c, 'resilience'));
operationsV2.get('/quota-plans', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createQuotaResilienceService(c.env);
  const result = await context.service.listQuotaPlans();
  if (result.status !== 'ok') return unavailableResponse(c, requestId, context.environmentId, 'quota-plan', result);
  return c.json(okEnvelope({ items: result.data }, {
    requestId, environmentId: context.environmentId, provenance: [result.provenance],
  }));
});

async function respond(c: any, kind: 'quota' | 'resilience') {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createQuotaResilienceService(c.env);
  const result = kind === 'quota' ? await context.service.listQuotas() : await context.service.getResilience();
  if (result.status !== 'ok') {
    return unavailableResponse(c, requestId, context.environmentId, kind, result);
  }
  const data = kind === 'quota' ? { items: result.data } : result.data;
  return c.json(okEnvelope(data, { requestId, environmentId: context.environmentId, provenance: [result.provenance] }));
}

function unavailableResponse(c: any, requestId: string, environmentId: string, kind: string,
  result: { status: string; reason?: string; httpStatus?: number | null }) {
  const details = result.status === 'unavailable'
    ? { reason: result.reason, upstreamStatus: result.httpStatus }
    : { reason: 'upstream_resource_not_found', upstreamStatus: 404 };
  return c.json(errorEnvelope({
    code: kind === 'resilience' ? 'RESILIENCE_UNAVAILABLE' : kind === 'quota-plan' ? 'QUOTA_PLANS_UNAVAILABLE' : 'QUOTA_UNAVAILABLE',
    message: `OmniRoute ${kind} observations are unavailable.`, retryable: true, source: 'omniroute', details,
  }, { requestId, environmentId }), 503);
}
