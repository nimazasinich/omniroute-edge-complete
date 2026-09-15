import { describe, expect, it, vi } from 'vitest';
import { setupTest } from './testHarness';

describe('/api/v2/system', () => {
  it('returns a standard v2 status envelope with provenance when OmniRoute is not configured', async () => {
    const { call } = await setupTest();

    const res = await call('/api/v2/system/status', { headers: { 'X-Request-ID': 'req-v2-status' } }, { auth: false });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.apiVersion).toBe('v2');
    expect(body.meta.requestId).toBe('req-v2-status');
    expect(body.meta).toMatchObject({ source: 'omniroute', authoritative: false });
    expect(body.data.routingAuthority).toBe('omniroute');
    expect(body.data.omniroute.configured).toBe(false);
    expect(body.data.omniroute.reachable).toBeNull();
    expect(body.data.omniroute.provenance).toMatchObject({
      source: 'omniroute',
      authoritative: false,
      environmentId: 'local',
    });
  });

  it('exposes capability gates without pretending provider/model management is writable', async () => {
    const { call } = await setupTest();

    const res = await call('/api/v2/system/capabilities', {}, { auth: false });
    const body = await res.json();
    const capabilities = new Map(body.data.capabilities.map((capability: any) => [capability.id, capability]));

    expect(res.status).toBe(200);
    expect(body.data.routingAuthority).toBe('omniroute');
    expect(capabilities.get('system.status')).toMatchObject({ supported: true, read: true, write: false });
    expect(capabilities.get('system.environment')).toMatchObject({ supported: true, read: true, write: false });
    expect(capabilities.get('providers.read')).toMatchObject({ supported: false, read: false, write: false });
    expect(capabilities.get('providers.snapshot.read')).toMatchObject({
      supported: true,
      source: 'local-snapshot',
      write: false,
    });
  });

  it('detects model-read capability without claiming provider-management support', async () => {
    const { db, call } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }], meta: { version: '3.8.4', build: 'build-7' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const res = await appFetchWithEnv(call, db, {
        OMNIROUTE_ORIGIN: 'https://omniroute.test',
        ENVIRONMENT: 'test-live',
      });
      const body = await res.json();
      const capabilities = new Map(body.data.capabilities.map((capability: any) => [capability.id, capability]));

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(new URL('https://omniroute.test/v1/models'), expect.any(Object));
      expect(body.data.environment).toMatchObject({ id: 'test-live', mode: 'live' });
      expect(capabilities.get('providers.read')).toMatchObject({ supported: false, read: false, write: false });
      expect(capabilities.get('models.read')).toMatchObject({ supported: true, read: true, write: false });
      expect(body.meta.provenance[0]).toMatchObject({ source: 'omniroute', authoritative: true });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('returns environment identity with degraded status when a configured origin is unreachable', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));

    try {
      const app = (await import('../app')).default;
      const res = await app.fetch(
        new Request('http://test.local/api/v2/system/environment', { headers: { 'X-Request-ID': 'req-environment' } }),
        { db, OMNIROUTE_ORIGIN: 'https://omniroute.test', ENVIRONMENT: 'staging' },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual({ id: 'staging', label: 'staging', mode: 'degraded' });
      expect(body.meta).toMatchObject({
        requestId: 'req-environment',
        source: 'omniroute',
        authoritative: false,
        environmentId: 'staging',
      });
      expect(body.meta.warnings).toContain('connection refused');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('enables provider reads only after the management endpoint returns its verified schema', async () => {
    const { db } = await setupTest();
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'model-a' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-OmniRoute-Version': '3.8.51' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ connections: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    try {
      const app = (await import('../app')).default;
      const response = await app.fetch(new Request('http://test.local/api/v2/system/status'), {
        db,
        OMNIROUTE_ORIGIN: 'https://omniroute.test',
      });
      const body = await response.json();
      expect(body.data.omniroute).toMatchObject({
        version: '3.8.51',
        capabilities: ['inference.models', 'management.providers.read'],
        apiVariants: ['/v1/models', '/api/providers'],
      });
    } finally {
      fetchMock.mockRestore();
    }
  });
});

async function appFetchWithEnv(call: Awaited<ReturnType<typeof setupTest>>['call'], db: any, env: Record<string, string>) {
  void call;
  const app = (await import('../app')).default;
  return app.fetch(new Request('http://test.local/api/v2/system/capabilities'), { db, ...env });
}
