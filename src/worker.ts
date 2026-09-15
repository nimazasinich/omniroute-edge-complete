import app, { type AppBindings } from './server/app';
import { getD1Db, type D1Binding } from './server/db/d1';
import { apiKeys } from './server/db/schema';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
  handleGatewayRequest,
  type GatewayAuthResult,
  type RateLimitBinding,
} from './edge/gatewayCore';
import { recordGatewayTelemetry } from './edge/d1Telemetry';

// Cloudflare Worker entry point for Canonical V3.
// /v1/* is the single production gateway path. OmniRoute is the sole provider/model
// routing authority; the edge authenticates, rate-limits, records honest telemetry,
// and transparently streams the upstream response without retry/fallback.

interface WorkerEnv {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
  DB: D1Binding;
  RATE_LIMITER?: RateLimitBinding;
  ENVIRONMENT?: string;
  ROUTING_AUTHORITY?: string;
  BOOTSTRAP_SECRET?: string;
  GATEWAY_AUTH_TOKEN?: string;
  OMNIROUTE_ORIGIN?: string;
  OMNIROUTE_ORIGIN_TOKEN?: string;
  INITIAL_ADMIN_EMAIL?: string;
  INITIAL_ADMIN_USERNAME?: string;
  INITIAL_ADMIN_PASSWORD?: string;
  AUTH_SESSION_TTL_HOURS?: string;
  AUTH_COOKIE_SECURE?: string;
  AUTH_OAUTH_AUTO_PROVISION?: string;
  AUTH_ALLOWED_EMAIL_DOMAINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_TENANT_ID?: string;
}

// Minimal structural stand-in for Cloudflare's `ExecutionContext`.
interface MinimalExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hasGatewayAuthConfigured(env: WorkerEnv): Promise<boolean> {
  if (env.GATEWAY_AUTH_TOKEN?.trim()) return true;
  const db = getD1Db(env.DB);
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.role, 'gateway'), eq(apiKeys.revoked, false)),
  });
  return !!row;
}

async function authenticateGatewayToken(env: WorkerEnv, supplied: string | undefined): Promise<GatewayAuthResult> {
  const expected = env.GATEWAY_AUTH_TOKEN?.trim();
  if (supplied && expected && safeEqual(supplied, expected)) {
    return { configured: true, authenticated: true, identity: 'env-gateway' };
  }

  // Avoid a D1 bcrypt lookup when no token was supplied. We still need to distinguish
  // "auth not configured" from "auth configured but credential missing".
  if (!supplied) {
    return { configured: !!expected || await hasGatewayAuthConfigured(env), authenticated: false };
  }

  const db = getD1Db(env.DB);
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
    configured: !!expected || candidates.length > 0 || await hasGatewayAuthConfigured(env),
    authenticated: false,
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: MinimalExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/favicon.ico') {
      return Response.redirect(new URL('/favicon.svg', url).toString(), 302);
    }

    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) {
      return handleGatewayRequest(request, {
        authenticate: (token) => authenticateGatewayToken(env, token),
        rateLimiter: env.RATE_LIMITER,
        origin: env.OMNIROUTE_ORIGIN,
        originToken: env.OMNIROUTE_ORIGIN_TOKEN,
        recordTelemetry: (event) => recordGatewayTelemetry(env.DB, event),
        defer: (promise) => ctx.waitUntil(promise),
      });
    }

    if (env.ASSETS && !url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const bindings: AppBindings = {
      db: getD1Db(env.DB),
      BOOTSTRAP_SECRET: env.BOOTSTRAP_SECRET,
      OMNIROUTE_ORIGIN: env.OMNIROUTE_ORIGIN,
      OMNIROUTE_ORIGIN_TOKEN: env.OMNIROUTE_ORIGIN_TOKEN,
      ENVIRONMENT: env.ENVIRONMENT,
      INITIAL_ADMIN_EMAIL: env.INITIAL_ADMIN_EMAIL,
      INITIAL_ADMIN_USERNAME: env.INITIAL_ADMIN_USERNAME,
      INITIAL_ADMIN_PASSWORD: env.INITIAL_ADMIN_PASSWORD,
      AUTH_SESSION_TTL_HOURS: env.AUTH_SESSION_TTL_HOURS,
      AUTH_COOKIE_SECURE: env.AUTH_COOKIE_SECURE,
      AUTH_OAUTH_AUTO_PROVISION: env.AUTH_OAUTH_AUTO_PROVISION,
      AUTH_ALLOWED_EMAIL_DOMAINS: env.AUTH_ALLOWED_EMAIL_DOMAINS,
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
      GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
      MICROSOFT_CLIENT_ID: env.MICROSOFT_CLIENT_ID,
      MICROSOFT_CLIENT_SECRET: env.MICROSOFT_CLIENT_SECRET,
      MICROSOFT_TENANT_ID: env.MICROSOFT_TENANT_ID,
    };
    return app.fetch(request, bindings, ctx as any);
  },
};
