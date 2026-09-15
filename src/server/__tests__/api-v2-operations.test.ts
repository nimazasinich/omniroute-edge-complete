import { describe, expect, it, vi } from 'vitest';
import { setupTest } from './testHarness';

describe('/api/v2 operational reads', () => {
  it('returns structured unavailable responses while OmniRoute is offline', async () => {
    const { call } = await setupTest();
    const quota = await call('/api/v2/quotas', { headers: { 'X-Request-ID': 'quota-offline' } }, { auth: false });
    const resilience = await call('/api/v2/resilience', {}, { auth: false });
    expect(quota.status).toBe(503);
    expect(await quota.json()).toMatchObject({ error: { code: 'QUOTA_UNAVAILABLE', requestId: 'quota-offline' } });
    expect(resilience.status).toBe(503);
    expect(await resilience.json()).toMatchObject({ error: { code: 'RESILIENCE_UNAVAILABLE' } });
  });

  it('preserves unknown quota values and uses only explicit monitor observations', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      quotaMonitor: { monitors: [
        { provider: 'openai', accountId: 'account-1', status: 'healthy', lastSuccessAt: '2026-09-14T02:00:00Z', lastResetAt: null, lastQuotaPercent: 64, lastQuotaUsed: 36, lastQuotaTotal: 100 },
        { provider: 'anthropic', accountId: 'account-2', status: 'starting', lastPolledAt: null, lastQuotaPercent: null, lastQuotaUsed: null, lastQuotaTotal: null },
      ] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/quotas'), { db, OMNIROUTE_ORIGIN: 'https://omniroute.test' });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.items[0]).toMatchObject({ providerId: 'openai', accountId: 'account-1', remainingPercent: 64, used: 36, limit: 100 });
      expect(body.data.items[1]).toMatchObject({ providerId: 'anthropic', remainingPercent: null, used: null, limit: null });
      expect(fetchMock.mock.calls[0][0].toString()).toContain('/api/monitoring/health');
      expect(fetchMock.mock.calls[0][0].toString()).not.toContain('/api/usage/quota');
    } finally { fetchMock.mockRestore(); }
  });

  it('keeps breaker, cooldown, lockout, and fallback mechanisms separate', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      providerBreakers: [{ provider: 'openai', state: 'OPEN', failureCount: 3, lastFailure: '2026-09-14T02:00:00Z', retryAfterMs: 5000 }],
      connectionHealth: { openai: { coolingDown: 1, total: 2, soonestRetryAfterMs: 2000 } },
      lockouts: { 'openai/gpt-5': { reason: 'rate_limit', until: '2026-09-14T02:05:00Z', failureCount: 2 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/resilience'), { db, OMNIROUTE_ORIGIN: 'https://omniroute.test' });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.providerBreakers[0]).toMatchObject({ providerId: 'openai', state: 'OPEN', failureCount: 3 });
      expect(body.data.connectionCooldowns[0]).toEqual({ providerId: 'openai', coolingDown: 1, total: 2, soonestRetryAfterMs: 2000 });
      expect(body.data.modelLockouts[0]).toMatchObject({ modelReference: 'openai/gpt-5', reason: 'rate_limit', failureCount: 2 });
      expect(body.data.connectionFallback).toEqual({ supported: false, reason: 'not-exposed' });
      expect(body.data.comboFallback).toEqual({ supported: false, reason: 'not-exposed' });
    } finally { fetchMock.mockRestore(); }
  });
});
