import type { Client } from '@libsql/client';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { apiKeys, requests } from '../server/db/schema';
import type { AppDb } from '../server/db/types';
import type { GatewayAuthResult, GatewayTelemetryEvent, RateLimitBinding } from './gatewayCore';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hasGatewayAuthConfigured(db: AppDb, envToken?: string): Promise<boolean> {
  if (envToken?.trim()) return true;
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.role, 'gateway'), eq(apiKeys.revoked, false)),
  });
  return Boolean(row);
}

export function createNodeGatewayAuthenticator(db: AppDb, configuredToken?: string) {
  const expected = configuredToken?.trim();
  return async (supplied: string | undefined): Promise<GatewayAuthResult> => {
    if (supplied && expected && safeEqual(supplied, expected)) {
      return { configured: true, authenticated: true, identity: 'env-gateway' };
    }
    if (!supplied) {
      return { configured: Boolean(expected) || await hasGatewayAuthConfigured(db, expected), authenticated: false };
    }

    const candidates = await db.query.apiKeys.findMany({
      where: and(
        eq(apiKeys.keyPrefix, supplied.slice(0, 12)),
        eq(apiKeys.role, 'gateway'),
        eq(apiKeys.revoked, false),
      ),
    });
    for (const candidate of candidates) {
      if (await bcrypt.compare(supplied, candidate.keyHash)) {
        await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, candidate.id));
        return { configured: true, authenticated: true, identity: candidate.id };
      }
    }
    return {
      configured: Boolean(expected) || candidates.length > 0 || await hasGatewayAuthConfigured(db, expected),
      authenticated: false,
    };
  };
}

export function createNodeRateLimiter(
  client: Client,
  { maxRequests = 60, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {},
): RateLimitBinding {
  return {
    async limit({ key }) {
      const now = Date.now();
      const cutoff = now - windowMs;
      const result = await client.execute({
        sql: `
          INSERT INTO gateway_rate_limits (identity, window_start, request_count)
          VALUES (?, ?, 1)
          ON CONFLICT(identity) DO UPDATE SET
            window_start = CASE
              WHEN gateway_rate_limits.window_start <= ? THEN excluded.window_start
              ELSE gateway_rate_limits.window_start
            END,
            request_count = CASE
              WHEN gateway_rate_limits.window_start <= ? THEN 1
              ELSE gateway_rate_limits.request_count + 1
            END
          RETURNING request_count
        `,
        args: [key, now, cutoff, cutoff],
      });
      const count = Number(result.rows[0]?.request_count ?? maxRequests + 1);
      return { success: count <= maxRequests };
    },
  };
}

function requestTypeFromPath(path: string): string {
  if (path === '/v1/chat/completions') return 'chat';
  if (path === '/v1/embeddings') return 'embeddings';
  if (path === '/v1/models') return 'models';
  return 'api';
}

export async function recordNodeGatewayTelemetry(db: AppDb, event: GatewayTelemetryEvent): Promise<void> {
  const routingReason = event.outcome === 'rate_limited'
    ? 'edge-rate-limit'
    : event.error === 'origin_not_ready'
      ? 'edge-origin-guard'
      : event.error === 'rate_limit_not_ready'
        ? 'edge-rate-limit-config'
        : 'omniroute';
  const status = event.outcome === 'success' ? 'success' : event.outcome === 'rate_limited' ? 'blocked' : 'error';

  await db.insert(requests).values({
    id: event.id,
    timestamp: event.timestamp,
    clientId: event.clientId,
    requestType: requestTypeFromPath(event.path),
    requestedModel: event.requestedModel ?? null,
    selectedModel: null,
    providerId: null,
    latencyMs: event.latencyMs,
    tokensInput: 0,
    tokensOutput: 0,
    cost: 0,
    observedTokensInput: null,
    observedTokensOutput: null,
    observedCost: null,
    routingReason,
    status,
    path: event.path,
    correlationId: event.correlationId,
    statusCode: event.statusCode,
    error: event.error,
    streaming: event.streaming,
  });
}
