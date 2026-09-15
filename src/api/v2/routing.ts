import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '../../server/app';
import { createRoutingIntelligenceService } from '../../services/routingIntelligenceService';
import { parseResourceId, RequestValidationError } from './catalogValidation';
import { errorEnvelope, getRequestId, okEnvelope } from './envelope';
import { parseAutoChannel } from './routingValidation';

export const routingV2 = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

routingV2.get('/decisions', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createRoutingIntelligenceService(c.env);
  const result = await context.service.listDecisions();
  if (result.status !== 'ok') return readFailure(c, requestId, context.environmentId, result);
  return c.json(okEnvelope({ items: result.data }, {
    requestId, environmentId: context.environmentId, provenance: [result.provenance],
  }));
});

routingV2.get('/decisions/:requestId', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createRoutingIntelligenceService(c.env);
  const targetRequestId = parseResourceId(c.req.param('requestId'), 'requestId');
  const result = await context.service.getDecision(targetRequestId);
  if (result.status !== 'ok') return readFailure(c, requestId, context.environmentId, result);
  return c.json(okEnvelope(result.data, {
    requestId, environmentId: context.environmentId, provenance: [result.provenance],
  }));
});

routingV2.get('/auto', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createRoutingIntelligenceService(c.env);
  const result = await context.service.inspectAutoCombo(parseAutoChannel(new URL(c.req.url).searchParams.get('channel')));
  if (result.status !== 'ok') return readFailure(c, requestId, context.environmentId, result);
  return c.json(okEnvelope(result.data, {
    requestId, environmentId: context.environmentId, provenance: [result.provenance],
  }));
});

routingV2.get('/explainability', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createRoutingIntelligenceService(c.env);
  const result = await context.service.getExplainabilitySnapshot();
  if (result.status !== 'ok') return readFailure(c, requestId, context.environmentId, result);
  return c.json(okEnvelope(result.data, {
    requestId, environmentId: context.environmentId, provenance: [result.provenance],
  }));
});

routingV2.onError((error, c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const environmentId = c.env?.ENVIRONMENT?.trim() || 'local';
  if (error instanceof RequestValidationError) {
    return c.json(errorEnvelope({
      code: 'INVALID_REQUEST', message: error.message, retryable: false, source: 'control-api',
    }, { requestId, environmentId }), 400);
  }
  console.error('v2 routing intelligence request failed', { requestId, error });
  return c.json(errorEnvelope({
    code: 'ROUTING_INTELLIGENCE_UNAVAILABLE', message: 'OmniRoute routing intelligence is unavailable.',
    retryable: true, source: 'omniroute',
  }, { requestId, environmentId }), 503);
});

function readFailure(c: any, requestId: string, environmentId: string, result: { status: string; reason?: string; httpStatus?: number | null }) {
  const notFound = result.status === 'not-found';
  return c.json(errorEnvelope({
    code: notFound ? 'ROUTING_DECISION_NOT_FOUND' : 'ROUTING_INTELLIGENCE_UNAVAILABLE',
    message: notFound ? 'Routing decision not found.' : 'OmniRoute routing intelligence is unavailable.',
    retryable: !notFound,
    source: 'omniroute',
    details: notFound ? undefined : { reason: result.reason, upstreamStatus: result.httpStatus },
  }, { requestId, environmentId }), notFound ? 404 : 503);
}
