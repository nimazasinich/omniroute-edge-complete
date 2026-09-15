import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '../../server/app';
import { createObservabilityService } from '../../services/observabilityService';
import { createTelemetryIngestionService } from '../../services/telemetryIngestionService';
import { parseResourceId, RequestValidationError } from './catalogValidation';
import { errorEnvelope, getRequestId, okEnvelope } from './envelope';

export const observabilityV2 = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

observabilityV2.get('/requests', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const query = parseQuery(new URL(c.req.url));
  const result = await createObservabilityService(c.env).listRequests(query);
  return c.json(okEnvelope({ items: result.items }, { requestId, environmentId: c.env?.ENVIRONMENT?.trim() || 'local', provenance: [result.provenance], pagination: result.pagination }));
});

observabilityV2.get('/requests/:requestId/trace', async (c) => {
  const envelopeRequestId = getRequestId(c.req.raw.headers);
  const environmentId = c.env?.ENVIRONMENT?.trim() || 'local';
  const trace = await createObservabilityService(c.env).getTrace(parseResourceId(c.req.param('requestId'), 'requestId'));
  if (!trace) return c.json(errorEnvelope({ code: 'REQUEST_NOT_FOUND', message: 'Request not found.', source: 'd1' }, { requestId: envelopeRequestId, environmentId }), 404);
  return c.json(okEnvelope(trace, { requestId: envelopeRequestId, environmentId, provenance: trace.provenance }));
});

observabilityV2.get('/metrics', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const hours = parseHours(new URL(c.req.url).searchParams.get('hours'));
  const result = await createObservabilityService(c.env).metrics(Date.now() - hours * 60 * 60 * 1000);
  return c.json(okEnvelope(result.data, { requestId, environmentId: c.env?.ENVIRONMENT?.trim() || 'local', provenance: [result.provenance] }));
});

observabilityV2.get('/routing-decisions', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const limit = boundedInteger(new URL(c.req.url).searchParams.get('limit'), 'limit', 50, 1, 200);
  const result = await createObservabilityService(c.env).listIndexedDecisions(limit);
  return c.json(okEnvelope({ items: result.items }, { requestId, environmentId: c.env?.ENVIRONMENT?.trim() || 'local', provenance: [result.provenance] }));
});

observabilityV2.post('/ingest/omniroute', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createTelemetryIngestionService(c.env);
  const result = await context.service.ingestPersistedOutcomes();
  if (result.status !== 'ok') {
    const details = result.status === 'unavailable'
      ? { reason: result.reason, upstreamStatus: result.httpStatus }
      : { reason: 'upstream_resource_not_found', upstreamStatus: 404 };
    return c.json(errorEnvelope({
      code: 'OMNIROUTE_INGESTION_UNAVAILABLE', message: 'OmniRoute telemetry ingestion is unavailable.',
      retryable: true, source: 'omniroute', details,
    }, { requestId, environmentId: context.environmentId }), 503);
  }
  return c.json(okEnvelope(result.data, {
    requestId, environmentId: context.environmentId, provenance: [result.provenance],
  }));
});

observabilityV2.onError((error, c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const environmentId = c.env?.ENVIRONMENT?.trim() || 'local';
  if (error instanceof RequestValidationError) return c.json(errorEnvelope({ code: 'INVALID_REQUEST', message: error.message, source: 'control-api' }, { requestId, environmentId }), 400);
  console.error('v2 observability request failed', { requestId, error });
  return c.json(errorEnvelope({ code: 'OBSERVABILITY_UNAVAILABLE', message: 'Observability read model is unavailable.', retryable: true, source: 'd1' }, { requestId, environmentId }), 503);
});

function parseQuery(url: URL) {
  const limit = boundedInteger(url.searchParams.get('limit'), 'limit', 50, 1, 200);
  const offset = boundedInteger(url.searchParams.get('offset'), 'offset', 0, 0, 100000);
  const correlationId = url.searchParams.get('correlationId')?.trim() || undefined;
  if (correlationId && correlationId.length > 512) throw new RequestValidationError('correlationId is invalid');
  return { limit, offset, correlationId };
}
function parseHours(raw: string | null) { return boundedInteger(raw, 'hours', 24, 1, 720); }
function boundedInteger(raw: string | null, label: string, fallback: number, min: number, max: number) {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new RequestValidationError(`${label} must be an integer`);
  const value = Number(raw);
  if (value < min || value > max) throw new RequestValidationError(`${label} must be between ${min} and ${max}`);
  return value;
}
