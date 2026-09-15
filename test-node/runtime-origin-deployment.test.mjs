import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createOriginIngress } from '../runtime/origin-ingress.mjs';

test('origin ingress exposes only health and the required inference routes', async () => {
  const forwarded = [];
  const ingress = createOriginIngress({
    runtimeOrigin: 'http://127.0.0.1:20129',
    originSharedSecret: 'worker-to-origin-secret',
    runtimeApiKey: 'runtime-only-key',
    fetchImpl: async (request) => {
      forwarded.push(request);
      return new Response(JSON.stringify({ object: 'list', data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-runtime': 'omniroute' },
      });
    },
  });

  for (const path of ['/', '/api/providers', '/api/auth/status', '/api/monitoring/health', '/debug']) {
    const response = await ingress(new Request(`https://origin.test${path}`));
    assert.equal(response.status, 404, `${path} must not be public`);
  }

  const models = await ingress(new Request('https://origin.test/v1/models', {
    headers: { authorization: 'Bearer worker-to-origin-secret', 'x-request-id': 'request-1' },
  }));
  assert.equal(models.status, 200);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].url, 'http://127.0.0.1:20129/v1/models');
  assert.equal(forwarded[0].headers.get('authorization'), 'Bearer runtime-only-key');
  assert.equal(forwarded[0].headers.get('x-request-id'), 'request-1');
  assert.equal(models.headers.get('x-runtime'), 'omniroute');
});

test('origin ingress requires a dedicated Worker credential before inference forwarding', async () => {
  let forwarded = 0;
  const ingress = createOriginIngress({
    runtimeOrigin: 'http://127.0.0.1:20129',
    originSharedSecret: 'worker-to-origin-secret',
    runtimeApiKey: 'runtime-only-key',
    fetchImpl: async () => {
      forwarded += 1;
      return new Response('{}');
    },
  });

  for (const authorization of [null, 'Bearer end-user-gateway-key', 'Bearer wrong-origin-key']) {
    const headers = authorization ? { authorization } : undefined;
    const response = await ingress(new Request('https://origin.test/v1/models', { headers }));
    assert.equal(response.status, 401);
  }
  assert.equal(forwarded, 0);

  const health = await ingress(new Request('https://origin.test/healthz'));
  assert.equal(health.status, 200, 'platform health probe remains available');
  assert.equal(forwarded, 1);
});

test('health reports unavailable when the real OmniRoute listener cannot be reached', async () => {
  const ingress = createOriginIngress({
    runtimeOrigin: 'http://127.0.0.1:20129',
    healthOrigin: 'http://127.0.0.1:20128',
    originSharedSecret: 'worker-to-origin-secret',
    runtimeApiKey: 'runtime-only-key',
    fetchImpl: async () => { throw new Error('connection refused'); },
  });
  const response = await ingress(new Request('https://origin.test/healthz'));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'omniroute_unavailable');
});

test('origin ingress preserves streaming response bodies and rejects unsupported methods', async () => {
  let upstreamFinished = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: first\n\n'));
      setTimeout(() => {
        upstreamFinished = true;
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }, 100);
    },
  });
  const ingress = createOriginIngress({
    runtimeOrigin: 'http://127.0.0.1:20129',
    originSharedSecret: 'worker-to-origin-secret',
    runtimeApiKey: 'runtime-only-key',
    fetchImpl: async () => new Response(stream, {
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
    }),
  });

  const response = await ingress(new Request('https://origin.test/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'explicit-model', stream: true, messages: [] }),
    headers: { 'content-type': 'application/json', authorization: 'Bearer worker-to-origin-secret' },
  }));
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(new TextDecoder().decode(first.value), 'data: first\n\n');
  assert.equal(upstreamFinished, false, 'first chunk must arrive before the upstream stream completes');
  const second = await reader.read();
  assert.equal(new TextDecoder().decode(second.value), 'data: [DONE]\n\n');
  assert.equal((await reader.read()).done, true);

  const rejected = await ingress(new Request('https://origin.test/v1/models', { method: 'POST', headers: { authorization: 'Bearer worker-to-origin-secret' } }));
  assert.equal(rejected.status, 405);
});

test('container contract pins the real runtime and fails closed on missing production secrets', async () => {
  const dockerfile = await readFile('Dockerfile.omniroute-origin', 'utf8');
  const dockerignore = await readFile('.dockerignore', 'utf8');
  const start = await readFile('runtime/start-origin.mjs', 'utf8');

  assert.match(dockerfile, /FROM node:24[^\n]*/);
  assert.match(dockerfile, /omniroute@3\.8\.50/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /USER omniroute/);
  assert.match(dockerfile, /VOLUME \["\/var\/lib\/omniroute"\]/);
  assert.match(dockerignore, /^\.env(?:\.\*)?$/m);
  assert.match(dockerignore, /^\.wrangler\/$/m);
  assert.match(dockerignore, /\.sqlite/);
  for (const required of ['STORAGE_ENCRYPTION_KEY', 'OMNIROUTE_API_KEY', 'ORIGIN_SHARED_SECRET', 'DATA_DIR', 'REQUIRE_API_KEY', 'API_PORT', 'DASHBOARD_PORT', 'API_HOST']) {
    assert.ok(start.includes(required), `start-origin.mjs must enforce ${required}`);
  }
  assert.match(start, /OMNIROUTE_SERVER_HOST[^\n]*127\.0\.0\.1/);
  assert.match(start, /API_HOST[^\n]*127\.0\.0\.1/);
});
