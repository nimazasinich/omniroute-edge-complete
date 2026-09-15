import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '../../server/app';
import { createCatalogServices } from '../../services/catalogService';
import { errorEnvelope, getRequestId, okEnvelope } from './envelope';
import { parseCatalogQuery, parseComparisonIds, parseResourceId, RequestValidationError } from './catalogValidation';

export const catalogV2 = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

catalogV2.get('/providers', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const services = createCatalogServices(c.env);
  const result = await services.providers.list(parseCatalogQuery(new URL(c.req.url)));
  return c.json(okEnvelope({ items: result.items }, {
    requestId,
    environmentId: services.environment.id,
    provenance: [result.provenance],
    pagination: result.pagination,
  }));
});

catalogV2.get('/providers/:connectionId', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const services = createCatalogServices(c.env);
  const id = parseResourceId(c.req.param('connectionId'), 'connectionId');
  const result = await services.providers.get(id);
  if (!result.item) return notFound(c, requestId, services.environment.id, 'PROVIDER_CONNECTION_NOT_FOUND', 'Provider connection not found.');
  return c.json(okEnvelope(result.item, {
    requestId,
    environmentId: services.environment.id,
    provenance: [result.provenance],
  }));
});

catalogV2.get('/models', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const services = createCatalogServices(c.env);
  const result = await services.models.list(parseCatalogQuery(new URL(c.req.url)));
  return c.json(okEnvelope({ items: result.items }, {
    requestId,
    environmentId: services.environment.id,
    provenance: [result.provenance],
    pagination: result.pagination,
  }));
});

catalogV2.get('/models/compare', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const services = createCatalogServices(c.env);
  const result = await services.models.compare(parseComparisonIds(new URL(c.req.url)));
  return c.json(okEnvelope({ items: result.items, missingIds: result.missingIds }, {
    requestId,
    environmentId: services.environment.id,
    provenance: [result.provenance],
  }));
});

catalogV2.get('/models/:modelId', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const services = createCatalogServices(c.env);
  const id = parseResourceId(decodeURIComponent(c.req.param('modelId')), 'modelId');
  const result = await services.models.get(id);
  if (!result.item) return notFound(c, requestId, services.environment.id, 'MODEL_NOT_FOUND', 'Model not found.');
  return c.json(okEnvelope(result.item, {
    requestId,
    environmentId: services.environment.id,
    provenance: [result.provenance],
  }));
});

catalogV2.onError((error, c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const environmentId = c.env?.ENVIRONMENT?.trim() || 'local';
  if (error instanceof RequestValidationError || error instanceof URIError) {
    return c.json(errorEnvelope({
      code: 'INVALID_REQUEST',
      message: error.message,
      retryable: false,
      source: 'control-api',
      details: error instanceof RequestValidationError ? error.details : undefined,
    }, { requestId, environmentId }), 400);
  }
  console.error('v2 catalog request failed', { requestId, error });
  return c.json(errorEnvelope({
    code: 'CATALOG_SERVICE_UNAVAILABLE',
    message: 'Catalog data is temporarily unavailable.',
    retryable: true,
    source: 'control-api',
  }, { requestId, environmentId }), 503);
});

function notFound(c: any, requestId: string, environmentId: string, code: string, message: string) {
  return c.json(errorEnvelope({ code, message, retryable: false, source: 'control-api' }, {
    requestId,
    environmentId,
  }), 404);
}
