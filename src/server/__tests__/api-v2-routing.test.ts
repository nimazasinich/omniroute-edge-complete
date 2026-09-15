import { describe, expect, it, vi } from 'vitest';
import { setupTest } from './testHarness';

describe('/api/v2/routing', () => {
  it('returns a structured unavailable response when OmniRoute telemetry is offline', async () => {
    const { call } = await setupTest();
    const response = await call('/api/v2/routing/decisions', {
      headers: { 'X-Request-ID': 'routing-offline' },
    }, { auth: false });
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toMatchObject({
      code: 'ROUTING_INTELLIGENCE_UNAVAILABLE', requestId: 'routing-offline', retryable: true,
    });
  });

  it('normalizes persisted call-log outcomes and excludes synthetic in-memory rows', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      {
        id: 'persisted-1', timestamp: '2026-09-14T01:00:00.000Z', status: 200,
        requestedModel: 'auto/coding', model: 'claude-opus', provider: 'anthropic',
        connectionId: 'connection-1', comboName: 'coding', comboStepId: 'step-1',
        comboExecutionKey: 'execution-1', correlationId: 'correlation-1', duration: 1250,
      },
      { id: 'active-1', active: true, status: 0, provider: 'openai', model: 'gpt' },
      { id: 'completed-memory-1', completed: true, status: 200, provider: 'openai', model: 'gpt' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/routing/decisions'), {
        db, OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0]).toMatchObject({
        requestId: 'persisted-1', correlationId: 'correlation-1', requestedModel: 'auto/coding',
        selected: {
          providerId: 'anthropic', connectionId: 'connection-1', modelId: 'claude-opus',
          comboId: 'coding', comboStepId: 'step-1', comboExecutionKey: 'execution-1',
        },
        strategy: null,
        reason: null,
        score: { supported: false, reason: 'not-exposed' },
        fallback: { supported: false, reason: 'not-exposed', attempts: [] },
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('uses only exact persisted runtime fields from route explainability', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      requestId: 'request-1',
      score: 0.99,
      fallbacksTriggered: [{ provider: 'fabricated-by-recompute' }],
      request: { id: 'request-1', requestedModel: 'auto/coding' },
      decisionReplay: {
        runtime: {
          source: 'call_logs', exact: true, selectedCallLogId: 'request-1',
          comboName: 'coding', comboStepId: 'step-2', comboExecutionKey: 'execution-2',
          provider: 'anthropic', model: 'claude-opus', connectionId: 'connection-2',
          status: 200, timestamp: '2026-09-14T01:00:00.000Z', durationMs: 900,
        },
        recompute: { runtimeSelectedScore: 0.99, candidates: [{ provider: 'other' }] },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/routing/decisions/request-1'), {
        db, OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.selected).toMatchObject({
        providerId: 'anthropic', connectionId: 'connection-2', modelId: 'claude-opus', comboId: 'coding',
      });
      expect(body.data.score).toEqual({ supported: false, reason: 'not-exposed' });
      expect(body.data.fallback).toEqual({ supported: false, reason: 'not-exposed', attempts: [] });
      expect(body.data.explainability).toMatchObject({ classification: 'omniroute-derived', score: 0.99 });
      expect(JSON.stringify(body)).not.toContain('fabricated-by-recompute');
      expect(JSON.stringify(body)).not.toContain('runtimeSelectedScore');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('exposes Auto Combo candidates as transparency data without choosing a winner', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      channel: 'auto/coding',
      candidates: [{
        provider: 'anthropic', connectionId: 'connection-1', model: 'claude-opus',
        modelStr: 'anthropic/claude-opus', excluded: false, reachable: true,
        breakerState: 'closed', connectionCooldown: false, modelLocked: false,
        freeAccessExclusion: null,
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/routing/auto?channel=coding'), {
        db, OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        channel: 'auto/coding', dispatchPool: false,
        winner: { supported: false, reason: 'not-exposed' },
      });
      expect(body.data.candidates[0]).toMatchObject({
        providerId: 'anthropic', connectionId: 'connection-1', modelId: 'claude-opus', reachable: true,
      });

      const invalid = await app.fetch(new Request('http://test.local/api/v2/routing/auto?channel=../bad'), {
        db, OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      expect(invalid.status).toBe(400);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
