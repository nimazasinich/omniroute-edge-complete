const ROUTES = new Map([
  ['/healthz', new Set(['GET'])],
  ['/v1/models', new Set(['GET'])],
  ['/v1/chat/completions', new Set(['POST'])],
]);

const jsonError = (status, code, message) => new Response(JSON.stringify({
  error: { code, message, type: code },
}), { status, headers: { 'content-type': 'application/json' } });

function matchesBearer(request, expected) {
  const supplied = request.headers.get('authorization') || '';
  const wanted = `Bearer ${expected}`;
  const suppliedBytes = Buffer.from(supplied);
  const wantedBytes = Buffer.from(wanted);
  return suppliedBytes.length === wantedBytes.length && timingSafeEqual(suppliedBytes, wantedBytes);
}

export function createOriginIngress({
  runtimeOrigin,
  healthOrigin = runtimeOrigin,
  originSharedSecret,
  runtimeApiKey,
  fetchImpl = fetch,
}) {
  const origin = new URL(runtimeOrigin);
  const health = new URL(healthOrigin);
  return async function handle(request) {
    const incoming = new URL(request.url);
    const methods = ROUTES.get(incoming.pathname);
    if (!methods) return jsonError(404, 'not_found', 'Route not found');
    if (!methods.has(request.method)) return jsonError(405, 'method_not_allowed', 'Method not allowed');
    if (incoming.pathname !== '/healthz' && !matchesBearer(request, originSharedSecret)) {
      return jsonError(401, 'invalid_origin_credential', 'Origin authentication required');
    }

    const runtimePath = incoming.pathname === '/healthz' ? '/api/health' : incoming.pathname;
    const target = new URL(runtimePath + incoming.search, incoming.pathname === '/healthz' ? health : origin);
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cf-connecting-ip');
    headers.delete('x-forwarded-for');
    headers.delete('x-forwarded-host');
    headers.delete('x-real-ip');
    headers.set('authorization', `Bearer ${runtimeApiKey}`);

    try {
      const init = { method: request.method, headers, redirect: 'manual' };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
        init.duplex = 'half';
      }
      const upstream = await fetchImpl(new Request(target, init));
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete('set-cookie');
      responseHeaders.delete('location');
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch {
      return jsonError(503, 'omniroute_unavailable', 'OmniRoute runtime unavailable');
    }
  };
}
import { timingSafeEqual } from 'node:crypto';

