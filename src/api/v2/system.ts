import { Hono } from 'hono';
import type { AppBindings, AppVariables } from '../../server/app';
import { createSystemService } from '../../services/systemService';
import { errorEnvelope, getRequestId, okEnvelope } from './envelope';

export const systemV2 = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

systemV2.get('/status', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const result = await createSystemService(c.env).getStatus();
  return c.json(okEnvelope(result.data, {
    requestId,
    environmentId: result.environment.id,
    provenance: result.provenance,
  }));
});

systemV2.get('/capabilities', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const result = await createSystemService(c.env).getCapabilities();
  return c.json(okEnvelope(result.data, {
    requestId,
    environmentId: result.environment.id,
    provenance: result.provenance,
  }));
});

systemV2.get('/sources', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const result = await createSystemService(c.env).getSources();
  return c.json(okEnvelope(result.data, {
    requestId,
    environmentId: result.environment.id,
    provenance: result.provenance,
  }));
});

systemV2.get('/environment', async (c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const result = await createSystemService(c.env).getEnvironment();
  return c.json(okEnvelope(result.data, {
    requestId,
    environmentId: result.environment.id,
    provenance: result.provenance,
  }));
});

systemV2.onError((error, c) => {
  const requestId = getRequestId(c.req.raw.headers);
  const environmentId = c.env?.ENVIRONMENT?.trim() || 'local';
  console.error('v2 system request failed', { requestId, error });
  return c.json(errorEnvelope({
    code: 'SYSTEM_SERVICE_UNAVAILABLE',
    message: 'System metadata is temporarily unavailable.',
    retryable: true,
    source: 'control-api',
  }, { requestId, environmentId }), 503);
});
