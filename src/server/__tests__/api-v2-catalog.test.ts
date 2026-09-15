import { describe, expect, it, vi } from 'vitest';
import { insertModel, insertProvider, setupTest } from './testHarness';

describe('/api/v2 provider and model catalog', () => {
  it('returns provider snapshot rows with unknown runtime health and non-authoritative provenance', async () => {
    const { db, call } = await setupTest();
    await insertProvider(db, { id: 'snapshot-provider', name: 'Snapshot Provider', healthStatus: 'healthy', latencyMs: 12 });

    const response = await call('/api/v2/providers', {}, { auth: false });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      id: 'snapshot-provider',
      name: 'Snapshot Provider',
      runtime: { health: 'unknown' },
      provenance: { source: 'local-snapshot', authoritative: false },
    });
    expect(body.data.items[0].runtime.latencyMs).toBeUndefined();
    expect(body.meta).toMatchObject({ source: 'local-snapshot', authoritative: false });
  });

  it('normalizes authoritative provider connections only from a valid OmniRoute management response', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      connections: [{
        id: 'connection-1', provider: 'openai', name: 'Primary OpenAI', isActive: true,
        authType: 'apikey', apiKey: 'must-not-leak', testStatus: 'success', latencyMs: 22,
      }],
      total: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/providers'), {
        db,
        OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.items).toEqual([expect.objectContaining({
        id: 'connection-1', providerId: 'openai', name: 'Primary OpenAI', enabled: true,
        authType: 'apikey', runtime: { health: 'unknown' },
        provenance: expect.objectContaining({ source: 'omniroute', authoritative: true }),
      })]);
      expect(JSON.stringify(body)).not.toContain('must-not-leak');
      expect(JSON.stringify(body)).not.toContain('latencyMs');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('returns authoritative live model IDs when the OmniRoute models endpoint responds', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'live-model', owned_by: 'live-provider' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/models'), {
        db,
        OMNIROUTE_ORIGIN: 'https://omniroute.test',
        ENVIRONMENT: 'live-test',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.items).toEqual([expect.objectContaining({
        id: 'live-model',
        providerId: 'live-provider',
        provenance: expect.objectContaining({ source: 'omniroute', authoritative: true }),
      })]);
      expect(body.meta).toMatchObject({ source: 'omniroute', authoritative: true });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('falls back to a clearly marked model snapshot when OmniRoute is unavailable', async () => {
    const { db } = await setupTest();
    const providerId = await insertProvider(db, { id: 'snapshot-provider' });
    await insertModel(db, providerId, { modelName: 'snapshot-model', capabilities: ['chat'], contextWindow: 32000 });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/models'), {
        db,
        OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.items[0]).toMatchObject({
        id: 'snapshot-model',
        capabilities: { chat: true },
        limits: { contextWindow: 32000 },
        provenance: { source: 'local-snapshot', authoritative: false },
      });
      expect(body.meta.warnings).toContain('Model inventory is a local snapshot, not live OmniRoute state.');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('supports validated filtering, pagination, detail, comparison, and structured errors', async () => {
    const { db, call } = await setupTest();
    const providerId = await insertProvider(db, { id: 'provider-a' });
    await insertModel(db, providerId, { modelName: 'alpha-model' });
    await insertModel(db, providerId, { modelName: 'beta-model' });

    const listResponse = await call('/api/v2/models?search=model&sort=id&order=desc&limit=1&offset=0', {}, { auth: false });
    const listBody = await listResponse.json();
    expect(listBody.data.items.map((item: any) => item.id)).toEqual(['beta-model']);
    expect(listBody.meta.pagination).toEqual({ offset: 0, limit: 1, returned: 1, total: 2 });

    const detailResponse = await call('/api/v2/models/alpha-model', {}, { auth: false });
    expect(detailResponse.status).toBe(200);
    expect((await detailResponse.json()).data.id).toBe('alpha-model');

    const compareResponse = await call('/api/v2/models/compare?ids=alpha-model,missing-model', {}, { auth: false });
    const compareBody = await compareResponse.json();
    expect(compareBody.data.items.map((item: any) => item.id)).toEqual(['alpha-model']);
    expect(compareBody.data.missingIds).toEqual(['missing-model']);

    const invalidResponse = await call('/api/v2/models?limit=0', { headers: { 'X-Request-ID': 'invalid-query' } }, { auth: false });
    const invalidBody = await invalidResponse.json();
    expect(invalidResponse.status).toBe(400);
    expect(invalidBody.error).toMatchObject({ code: 'INVALID_REQUEST', requestId: 'invalid-query', retryable: false });

    const missingResponse = await call('/api/v2/providers/missing', {}, { auth: false });
    expect(missingResponse.status).toBe(404);
    expect((await missingResponse.json()).error.code).toBe('PROVIDER_CONNECTION_NOT_FOUND');
  });
});
