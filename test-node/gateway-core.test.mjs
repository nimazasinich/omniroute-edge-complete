import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateOmniRouteOrigin,
  buildForwardHeaders,
  handleGatewayRequest,
} from '../src/edge/gatewayCore.ts';

test('origin validation is fail-closed and allows only https or localhost http', () => {
  assert.equal(validateOmniRouteOrigin(undefined).ok, false);
  assert.equal(validateOmniRouteOrigin('http://example.com').ok, false);
  assert.equal(validateOmniRouteOrigin('https://example.com').ok, true);
  assert.equal(validateOmniRouteOrigin('http://127.0.0.1:20128').ok, true);
});

test('forward headers strip client auth and edge identity headers', () => {
  const incoming = new Headers({
    Authorization: 'Bearer client-secret',
    Host: 'public.example',
    'CF-Connecting-IP': '203.0.113.9',
    'Content-Type': 'application/json',
  });
  const out = buildForwardHeaders(incoming, { requestId: 'r1', correlationId: 'c1', originToken: 'origin-secret' });
  assert.equal(out.get('Authorization'), 'Bearer origin-secret');
  assert.equal(out.get('Host'), null);
  assert.equal(out.get('CF-Connecting-IP'), null);
  assert.equal(out.get('X-Request-ID'), 'r1');
  assert.equal(out.get('X-Correlation-ID'), 'c1');
  assert.equal(out.get('Content-Type'), 'application/json');
});

test('gateway rejects bad auth before origin fetch', async () => {
  let fetched = false;
  const response = await handleGatewayRequest(new Request('https://edge.test/v1/models'), {
    authenticate: async () => ({ configured: true, authenticated: false }),
    rateLimiter: { limit: async () => ({ success: true }) },
    origin: 'https://origin.test',
    fetchImpl: async () => { fetched = true; return new Response('unexpected'); },
  });
  assert.equal(response.status, 401);
  assert.equal(fetched, false);
});

test('gateway rejects when rate limiter is not configured', async () => {
  const response = await handleGatewayRequest(new Request('https://edge.test/v1/models', { headers: { Authorization: 'Bearer x' } }), {
    authenticate: async () => ({ configured: true, authenticated: true, identity: 'client-1' }),
    origin: 'https://origin.test',
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.type, 'rate_limit_not_ready');
});

test('rate-limited request returns 429 and records honest telemetry', async () => {
  const telemetry = [];
  const response = await handleGatewayRequest(new Request('https://edge.test/v1/chat/completions', { headers: { Authorization: 'Bearer x' } }), {
    authenticate: async () => ({ configured: true, authenticated: true, identity: 'client-1' }),
    rateLimiter: { limit: async () => ({ success: false }) },
    origin: 'https://origin.test',
    generateId: () => 'req-1',
    now: () => 1000,
    recordTelemetry: async (event) => { telemetry.push(event); },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(response.status, 429);
  assert.equal(telemetry.length, 1);
  assert.equal(telemetry[0].outcome, 'rate_limited');
  assert.equal(telemetry[0].clientId, 'client-1');
});

test('successful upstream response preserves stream and routing authority headers', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: one\n\n'));
      controller.enqueue(encoder.encode('data: two\n\n'));
      controller.close();
    },
  });
  const response = await handleGatewayRequest(new Request('https://edge.test/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    body: '{}',
  }), {
    authenticate: async () => ({ configured: true, authenticated: true, identity: 'client-1' }),
    rateLimiter: { limit: async () => ({ success: true }) },
    origin: 'https://origin.test',
    generateId: () => 'req-2',
    now: (() => { let value = 1000; return () => value += 10; })(),
    fetchImpl: async (_url, init) => {
      assert.equal(new Headers(init.headers).get('Authorization'), null);
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Routing-Authority'), 'omniroute');
  assert.equal(await response.text(), 'data: one\n\ndata: two\n\n');
});

test('origin network failure is an honest 502 without edge fallback', async () => {
  let attempts = 0;
  const response = await handleGatewayRequest(new Request('https://edge.test/v1/models', { headers: { Authorization: 'Bearer x' } }), {
    authenticate: async () => ({ configured: true, authenticated: true, identity: 'client-1' }),
    rateLimiter: { limit: async () => ({ success: true }) },
    origin: 'https://origin.test',
    fetchImpl: async () => { attempts += 1; throw new Error('network down'); },
  });
  assert.equal(response.status, 502);
  assert.equal(attempts, 1);
});

test('authenticated origin-not-ready request is recorded as a real edge error', async () => {
  const telemetry = [];
  const response = await handleGatewayRequest(new Request('https://edge.test/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-real-request' }),
  }), {
    authenticate: async () => ({ configured: true, authenticated: true, identity: 'client-origin-missing' }),
    rateLimiter: { limit: async () => ({ success: true }) },
    origin: '',
    generateId: () => 'req-origin-missing',
    now: () => 1234,
    recordTelemetry: async (event) => { telemetry.push(event); },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.type, 'origin_not_ready');
  assert.equal(telemetry.length, 1);
  assert.equal(telemetry[0].id, 'req-origin-missing');
  assert.equal(telemetry[0].clientId, 'client-origin-missing');
  assert.equal(telemetry[0].outcome, 'error');
  assert.equal(telemetry[0].error, 'origin_not_ready');
  assert.equal(telemetry[0].requestedModel, 'gpt-real-request');
});

test('authenticated missing rate limiter is recorded instead of disappearing', async () => {
  const telemetry = [];
  const response = await handleGatewayRequest(new Request('https://edge.test/v1/models', { headers: { Authorization: 'Bearer x' } }), {
    authenticate: async () => ({ configured: true, authenticated: true, identity: 'client-rate-config' }),
    origin: 'https://origin.test',
    generateId: () => 'req-rate-config',
    now: () => 2000,
    recordTelemetry: async (event) => { telemetry.push(event); },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(response.status, 503);
  assert.equal(telemetry.length, 1);
  assert.equal(telemetry[0].error, 'rate_limit_not_ready');
  assert.equal(telemetry[0].statusCode, 503);
});
