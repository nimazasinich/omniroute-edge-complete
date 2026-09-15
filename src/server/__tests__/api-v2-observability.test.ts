import { describe, expect, it, vi } from 'vitest';
import { requests } from '../db/schema';
import { seedApiKey, setupTest } from './testHarness';

async function seedRequest(db: any) {
  await db.insert(requests).values({
    id: 'edge-request-1', timestamp: Date.now(), clientId: 'client-1', requestType: 'chat', requestedModel: 'auto/coding',
    latencyMs: 120, status: 'success', path: '/v1/chat/completions', correlationId: 'corr-1', statusCode: 200,
    streaming: false, observedTokensInput: 10, observedTokensOutput: 20, observedCost: null,
  });
}

describe('/api/v2/observability', () => {
  it('indexes only durable edge request observations with D1 provenance', async () => {
    const { db } = await setupTest(); await seedRequest(db);
    const app = (await import('../app')).default;
    const response = await app.fetch(new Request('http://test.local/api/v2/observability/requests?correlationId=corr-1'), { db });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.items[0]).toMatchObject({ requestId: 'edge-request-1', correlationId: 'corr-1', tokensInput: 10, tokensOutput: 20, cost: null });
    expect(body.meta).toMatchObject({ source: 'd1', authoritative: false, pagination: { total: 1, returned: 1 } });
  });

  it('correlates an edge request with exact OmniRoute detail without local attempt inference', async () => {
    const { db } = await setupTest(); await seedRequest(db);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      requestId: 'edge-request-1', generatedAt: '2026-09-14T03:00:00Z', routeType: 'combo', confidence: 'high',
      summary: 'OmniRoute generated explanation', score: 87, decision: { factors: [{ key: 'health', contribution: 10 }] },
      request: { id: 'edge-request-1', requestedModel: 'auto/coding' },
      decisionReplay: { runtime: { source: 'call_logs', exact: true, selectedCallLogId: 'edge-request-1', provider: 'openai', model: 'gpt-5', status: 200 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/observability/requests/edge-request-1/trace'), { db, OMNIROUTE_ORIGIN: 'https://omniroute.test' });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.stages[1]).toMatchObject({ stage: 'omniroute-decision', status: 'exposed', data: { explainability: { classification: 'omniroute-derived', score: 87 } } });
      expect(body.data.stages[2]).toEqual({ stage: 'provider-attempts', status: 'unavailable', data: null, reason: 'No exact OmniRoute attempt ingestion is configured.' });
      expect(JSON.stringify(body)).not.toContain('routing_decisions');
    } finally { fetchMock.mockRestore(); }
  });

  it('aggregates metrics only from observed nullable fields', async () => {
    const { db } = await setupTest(); await seedRequest(db);
    const app = (await import('../app')).default;
    const response = await app.fetch(new Request('http://test.local/api/v2/observability/metrics?hours=24'), { db });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ totalRequests: 1, successCount: 1, averageDurationMs: 120, observedTokensInput: 10, observedTokensOutput: 20, observedCost: null });
  });

  it('authenticates ingestion and persists only proven call-log outcomes', async () => {
    const { db, rawKey } = await setupTest();
    await seedRequest(db);
    const adminKey = await seedApiKey(db, 'admin');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      { id: 'edge-request-1', timestamp: '2026-09-14T04:00:00Z', requestedModel: 'auto/coding', provider: 'openai',
        connectionId: 'conn-1', model: 'gpt-5', status: 200, duration: 80, correlationId: 'corr-1' },
      { id: 'memory-only', active: true, provider: 'other', model: 'other', status: 200 },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    try {
      const app = (await import('../app')).default;
      const unauthenticated = await app.fetch(new Request('http://test.local/api/v2/observability/ingest/omniroute', { method: 'POST' }),
        { db, OMNIROUTE_ORIGIN: 'https://omniroute.test' });
      expect(unauthenticated.status).toBe(401);
      const gateway = await app.fetch(new Request('http://test.local/api/v2/observability/ingest/omniroute', {
        method: 'POST', headers: { Authorization: `Bearer ${rawKey}` },
      }), { db, OMNIROUTE_ORIGIN: 'https://omniroute.test' });
      expect(gateway.status).toBe(403);

      const ingested = await app.fetch(new Request('http://test.local/api/v2/observability/ingest/omniroute', {
        method: 'POST', headers: { Authorization: `Bearer ${adminKey}` },
      }), { db, OMNIROUTE_ORIGIN: 'https://omniroute.test' });
      expect(ingested.status).toBe(200);
      expect(await ingested.json()).toMatchObject({ data: { accepted: 1, skipped: 0, sourceRecords: 1 } });

      const indexed = await app.fetch(new Request('http://test.local/api/v2/observability/routing-decisions'), { db });
      const body = await indexed.json();
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0]).toMatchObject({ requestId: 'edge-request-1', correlationId: 'corr-1',
        provenance: { source: 'omniroute', authoritative: true } });
      expect(body.meta).toMatchObject({ source: 'd1', authoritative: false });

      const trace = await app.fetch(new Request('http://test.local/api/v2/observability/requests/edge-request-1/trace'),
        { db, OMNIROUTE_ORIGIN: 'https://omniroute.test' });
      const traceBody = await trace.json();
      expect(trace.status).toBe(200);
      expect(traceBody.data.stages).toEqual(expect.arrayContaining([
        expect.objectContaining({ stage: 'edge-request', status: 'observed' }),
        expect.objectContaining({ stage: 'omniroute-outcome', status: 'observed' }),
        expect.objectContaining({ stage: 'omniroute-decision', status: 'unavailable' }),
      ]));
    } finally { fetchMock.mockRestore(); }
  });
});
