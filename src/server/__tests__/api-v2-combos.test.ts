import { describe, expect, it, vi } from 'vitest';
import { setupTest } from './testHarness';

describe('/api/v2/combos', () => {
  it('returns structured unavailable state when no runtime Combo contract is reachable', async () => {
    const { call } = await setupTest();
    const response = await call('/api/v2/combos', { headers: { 'X-Request-ID': 'combo-unavailable' } }, { auth: false });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toMatchObject({
      code: 'OMNIROUTE_COMBOS_UNAVAILABLE',
      requestId: 'combo-unavailable',
      retryable: true,
      source: 'omniroute',
    });
  });

  it('normalizes only observed Combo targets from a valid OmniRoute response', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      combos: [{
        id: 'combo-1',
        name: 'coding',
        strategy: 'fallback',
        isActive: true,
        updatedAt: 42,
        models: [
          { provider: 'anthropic', connectionId: 'connection-1', model: 'claude', weight: 2 },
          'openai/gpt',
          {},
        ],
      }],
      total: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/combos'), {
        db,
        OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.items[0]).toMatchObject({
        id: 'combo-1', name: 'coding', strategy: 'fallback', enabled: true, revision: '42',
        provenance: { source: 'omniroute', authoritative: true },
      });
      expect(body.data.items[0].targets).toEqual([
        { providerId: 'anthropic', connectionId: 'connection-1', modelId: 'claude', order: 0, weight: 2 },
        { providerId: null, connectionId: null, modelId: 'openai/gpt', order: 1 },
        { providerId: null, connectionId: null, modelId: null, order: 2 },
      ]);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('returns Combo detail and a structured not-found error without adding mutation APIs', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      combos: [{ id: 'combo-1', name: 'coding', strategy: 'fallback', models: [] }], total: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      const app = (await import('../app')).default;
      const detail = await app.fetch(new Request('http://test.local/api/v2/combos/combo-1'), {
        db, OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      expect(detail.status).toBe(200);
      expect((await detail.json()).data.id).toBe('combo-1');

      const missing = await app.fetch(new Request('http://test.local/api/v2/combos/missing'), {
        db, OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      expect(missing.status).toBe(404);
      expect((await missing.json()).error.code).toBe('COMBO_NOT_FOUND');

      const mutation = await app.fetch(new Request('http://test.local/api/v2/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'new-combo', strategy: 'fallback', targets: [{ providerId: 'openai', modelId: 'gpt' }],
        }),
      }), {
        db, OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      expect(mutation.status).toBe(501);
      expect((await mutation.json()).error).toMatchObject({
        code: 'COMBO_MUTATION_RUNTIME_UNVERIFIED',
        details: { capability: 'combos.create', documented: true, runtimeVerified: false },
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('validates Combo mutation drafts and concurrency inputs before capability gating', async () => {
    const { call } = await setupTest();

    const invalidCreate = await call('/api/v2/combos', {
      method: 'POST',
      body: JSON.stringify({ name: '', strategy: 'fallback', targets: [] }),
    }, { auth: false });
    expect(invalidCreate.status).toBe(400);
    expect((await invalidCreate.json()).error.code).toBe('INVALID_REQUEST');

    const missingRevision = await call('/api/v2/combos/combo-1', {
      method: 'PATCH',
      body: JSON.stringify({ patch: { name: 'renamed' } }),
    }, { auth: false });
    expect(missingRevision.status).toBe(400);

    const validPatch = await call('/api/v2/combos/combo-1', {
      method: 'PATCH',
      body: JSON.stringify({ expectedRevision: 'rev-1', patch: { name: 'renamed' } }),
    }, { auth: false });
    expect(validPatch.status).toBe(501);
    expect((await validPatch.json()).error.details.capability).toBe('combos.update');

    const missingDeleteRevision = await call('/api/v2/combos/combo-1', { method: 'DELETE' }, { auth: false });
    expect(missingDeleteRevision.status).toBe(400);
  });
});
