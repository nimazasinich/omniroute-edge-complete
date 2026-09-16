export interface RateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export type OriginValidation =
  | { ok: true; origin: URL; reason?: undefined }
  | { ok: false; origin?: undefined; reason: 'missing' | 'invalid' | 'insecure' };

export function validateOmniRouteOrigin(raw: string | undefined): OriginValidation {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: false, reason: 'missing' };

  let origin: URL;
  try {
    origin = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const localHttp = origin.protocol === 'http:' && (origin.hostname === 'localhost' || origin.hostname === '127.0.0.1');
  if (origin.protocol !== 'https:' && !localHttp) return { ok: false, reason: 'insecure' };
  return { ok: true, origin };
}

export function deriveRequestIds(headers: Headers, generateId: () => string): { requestId: string; correlationId: string } {
  const requestId = headers.get('X-Request-ID')?.trim() || generateId();
  const correlationId = headers.get('X-Correlation-ID')?.trim() || requestId;
  return { requestId, correlationId };
}

export function buildForwardHeaders(
  incoming: Headers,
  options: { requestId: string; correlationId: string; originToken?: string | null },
): Headers {
  const headers = new Headers(incoming);
  for (const name of [
    'host',
    'cf-connecting-ip',
    'cf-ipcountry',
    'cf-ray',
    'x-forwarded-for',
    'x-forwarded-proto',
    'authorization',
  ]) {
    headers.delete(name);
  }

  if (options.originToken?.trim()) {
    headers.set('Authorization', `Bearer ${options.originToken.trim()}`);
  }
  headers.set('X-Request-ID', options.requestId);
  headers.set('X-Correlation-ID', options.correlationId);
  headers.set('X-OmniRoute-Edge', '1');
  return headers;
}

export async function enforceGatewayRateLimit(
  binding: RateLimitBinding | undefined,
  identity: string,
  _pathname: string,
): Promise<'allowed' | 'limited' | 'unconfigured'> {
  if (!binding) return 'unconfigured';
  // One quota bucket per authenticated gateway identity across the whole /v1 surface.
  const { success } = await binding.limit({ key: identity });
  return success ? 'allowed' : 'limited';
}

export interface GatewayAuthResult {
  configured: boolean;
  authenticated: boolean;
  identity?: string;
}

const MAX_MODEL_INSPECTION_BYTES = 1024 * 1024;

export async function extractRequestedModel(request: Request): Promise<string | null> {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return null;
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) return null;

  const declaredLength = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MODEL_INSPECTION_BYTES) return null;

  const clone = request.clone();
  if (!clone.body) return null;

  const reader = clone.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_MODEL_INSPECTION_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const model = (parsed as Record<string, unknown>).model;
    return typeof model === 'string' && model.trim() ? model.trim() : null;
  } catch {
    return null;
  }
}

export interface GatewayTelemetryEvent {
  id: string;
  timestamp: number;
  clientId: string;
  path: string;
  correlationId: string;
  statusCode: number;
  latencyMs: number;
  outcome: 'success' | 'error' | 'rate_limited';
  error: string | null;
  streaming: boolean;
  requestedModel?: string | null;
}

export interface GatewayRequestDeps {
  authenticate(token: string | undefined): Promise<GatewayAuthResult>;
  rateLimiter?: RateLimitBinding;
  origin?: string;
  originToken?: string;
  fetchImpl?: typeof fetch;
  generateId?: () => string;
  now?: () => number;
  recordTelemetry?: (event: GatewayTelemetryEvent) => Promise<void>;
  defer?: (promise: Promise<unknown>) => void;
}

function jsonError(status: number, message: string, type: string, headers?: HeadersInit): Response {
  return Response.json({ error: { message, type } }, { status, headers });
}

function scheduleTelemetry(deps: GatewayRequestDeps, event: GatewayTelemetryEvent): void {
  if (!deps.recordTelemetry) return;
  const work = deps.recordTelemetry(event).catch(() => undefined);
  if (deps.defer) deps.defer(work);
  else void work;
}

export async function handleGatewayRequest(request: Request, deps: GatewayRequestDeps): Promise<Response> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const supplied = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const auth = await deps.authenticate(supplied || undefined);

  if (!auth.configured) {
    return jsonError(503, 'Gateway authentication is not configured', 'edge_not_ready');
  }
  if (!auth.authenticated || !auth.identity) {
    return jsonError(401, 'Invalid API key', 'invalid_api_key', {
      'WWW-Authenticate': 'Bearer realm="omniroute-edge"',
    });
  }

  const incoming = new URL(request.url);
  const generateId = deps.generateId ?? (() => crypto.randomUUID());
  const { requestId, correlationId } = deriveRequestIds(request.headers, generateId);
  const now = deps.now ?? Date.now;

  const rateLimit = await enforceGatewayRateLimit(deps.rateLimiter, auth.identity, incoming.pathname);
  if (rateLimit === 'unconfigured') {
    scheduleTelemetry(deps, {
      id: requestId,
      timestamp: now(),
      clientId: auth.identity,
      path: incoming.pathname,
      correlationId,
      statusCode: 503,
      latencyMs: 0,
      outcome: 'error',
      error: 'rate_limit_not_ready',
      streaming: false,
      requestedModel: null,
    });
    return jsonError(503, 'Gateway rate limiting is not configured', 'rate_limit_not_ready', {
      'X-Request-ID': requestId,
      'X-Correlation-ID': correlationId,
    });
  }
  if (rateLimit === 'limited') {
    const timestamp = now();
    scheduleTelemetry(deps, {
      id: requestId,
      timestamp,
      clientId: auth.identity,
      path: incoming.pathname,
      correlationId,
      statusCode: 429,
      latencyMs: 0,
      outcome: 'rate_limited',
      error: 'rate_limit_exceeded',
      streaming: false,
      requestedModel: null,
    });
    return jsonError(429, 'Rate limit exceeded', 'rate_limit_exceeded', {
      'Retry-After': '60',
      'X-Request-ID': requestId,
      'X-Correlation-ID': correlationId,
    });
  }

  const requestedModel = await extractRequestedModel(request);
  const originValidation = validateOmniRouteOrigin(deps.origin);
  if (!originValidation.ok) {
    const message = originValidation.reason === 'insecure'
      ? 'OmniRoute origin must use HTTPS'
      : originValidation.reason === 'invalid'
        ? 'OmniRoute origin configuration is invalid'
        : 'OmniRoute origin is not configured';
    scheduleTelemetry(deps, {
      id: requestId,
      timestamp: now(),
      clientId: auth.identity,
      path: incoming.pathname,
      correlationId,
      statusCode: 503,
      latencyMs: 0,
      outcome: 'error',
      error: 'origin_not_ready',
      streaming: false,
      requestedModel,
    });
    return jsonError(503, message, 'origin_not_ready', {
      'X-Request-ID': requestId,
      'X-Correlation-ID': correlationId,
    });
  }

  const headers = buildForwardHeaders(request.headers, {
    requestId,
    correlationId,
    originToken: deps.originToken,
  });
  const target = new URL(incoming.pathname + incoming.search, originValidation.origin);
  const method = request.method.toUpperCase();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const startedAt = now();

  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      redirect: 'manual',
      signal: request.signal,
    };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }
    const upstream = await fetchImpl(target.toString(), init);
    const latencyMs = Math.max(0, now() - startedAt);
    const streaming = (upstream.headers.get('Content-Type') ?? '').toLowerCase().includes('text/event-stream');
    const outcome: GatewayTelemetryEvent['outcome'] = upstream.status < 400 ? 'success' : 'error';
    scheduleTelemetry(deps, {
      id: requestId,
      timestamp: startedAt,
      clientId: auth.identity,
      path: incoming.pathname,
      correlationId,
      statusCode: upstream.status,
      latencyMs,
      outcome,
      error: upstream.status < 400 ? null : `upstream_http_${upstream.status}`,
      streaming,
      requestedModel,
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('X-Request-ID', requestId);
    responseHeaders.set('X-Correlation-ID', correlationId);
    responseHeaders.set('X-Routing-Authority', 'omniroute');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scheduleTelemetry(deps, {
      id: requestId,
      timestamp: startedAt,
      clientId: auth.identity,
      path: incoming.pathname,
      correlationId,
      statusCode: 502,
      latencyMs: Math.max(0, now() - startedAt),
      outcome: 'error',
      error: message,
      streaming: false,
      requestedModel,
    });
    return jsonError(502, 'OmniRoute request failed', 'upstream_error');
  }
}
