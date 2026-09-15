import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '../../server/app';
import { createComboService } from '../../services/comboService';
import { parseResourceId, RequestValidationError } from './catalogValidation';
import { parseComboDraft, parseComboPatch, parseComboTestInput } from './comboValidation';
import { errorEnvelope, getRequestId, okEnvelope } from './envelope';

export const combosV2 = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

combosV2.get('/', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createComboService(c.env);
  const result = await context.service.list();
  if (!result) return unavailable(c, requestId, context.environmentId);
  return c.json(okEnvelope({ items: result.items }, {
    requestId,
    environmentId: context.environmentId,
    provenance: [result.provenance],
  }));
});

combosV2.get('/:comboId', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createComboService(c.env);
  const comboId = parseResourceId(c.req.param('comboId'), 'comboId');
  const result = await context.service.get(comboId);
  if (!result) return unavailable(c, requestId, context.environmentId);
  if (!result.item) {
    return c.json(errorEnvelope({
      code: 'COMBO_NOT_FOUND', message: 'Combo not found.', retryable: false, source: 'control-api',
    }, { requestId, environmentId: context.environmentId }), 404);
  }
  return c.json(okEnvelope(result.item, {
    requestId,
    environmentId: context.environmentId,
    provenance: [result.provenance],
  }));
});

combosV2.post('/', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createComboService(c.env);
  const result = await context.service.create(parseComboDraft(await readJson(c.req.raw)));
  return unsupported(c, requestId, context.environmentId, result);
});

combosV2.patch('/:comboId', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createComboService(c.env);
  const comboId = parseResourceId(c.req.param('comboId'), 'comboId');
  const result = await context.service.update(comboId, parseComboPatch(await readJson(c.req.raw)));
  return unsupported(c, requestId, context.environmentId, result);
});

combosV2.delete('/:comboId', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createComboService(c.env);
  const comboId = parseResourceId(c.req.param('comboId'), 'comboId');
  const expectedRevision = c.req.header('If-Match')?.trim();
  if (!expectedRevision) throw new RequestValidationError('If-Match header with the expected revision is required');
  const result = await context.service.delete(comboId, expectedRevision);
  return unsupported(c, requestId, context.environmentId, result);
});

combosV2.post('/:comboId/test', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const context = createComboService(c.env);
  const comboId = parseResourceId(c.req.param('comboId'), 'comboId');
  const result = await context.service.test(comboId, parseComboTestInput(await readJson(c.req.raw)));
  return unsupported(c, requestId, context.environmentId, result);
});

combosV2.onError((error, c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const environmentId = c.env?.ENVIRONMENT?.trim() || 'local';
  if (error instanceof RequestValidationError) {
    return c.json(errorEnvelope({
      code: 'INVALID_REQUEST', message: error.message, retryable: false, source: 'control-api',
    }, { requestId, environmentId }), 400);
  }
  console.error('v2 combo request failed', { requestId, error });
  return unavailable(c, requestId, environmentId);
});

function unavailable(c: any, requestId: string, environmentId: string) {
  return c.json(errorEnvelope({
    code: 'OMNIROUTE_COMBOS_UNAVAILABLE',
    message: 'OmniRoute Combo management read access is unavailable.',
    retryable: true,
    source: 'omniroute',
  }, { requestId, environmentId }), 503);
}

function unsupported(c: any, requestId: string, environmentId: string, result: Awaited<ReturnType<ReturnType<typeof createComboService>['service']['create']>>) {
  return c.json(errorEnvelope({
    code: 'COMBO_MUTATION_RUNTIME_UNVERIFIED',
    message: 'Combo mutation is not enabled for this OmniRoute runtime.',
    retryable: false,
    source: 'omniroute',
    details: result,
  }, { requestId, environmentId }), 501);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RequestValidationError('body must contain valid JSON');
  }
}
