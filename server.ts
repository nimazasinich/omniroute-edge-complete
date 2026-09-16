import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import app, { type AppBindings } from './src/server/app';
import { getNodeClient, getNodeDb, initializeDb } from './src/server/db/node';
import { handleGatewayRequest } from './src/edge/gatewayCore';
import {
  createNodeGatewayAuthenticator,
  createNodeRateLimiter,
  recordNodeGatewayTelemetry,
} from './src/edge/nodeGateway';
import { startEmbeddedOmniRoute } from './runtime/embedded-omniroute.mjs';
import fs from 'node:fs';

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST?.trim() || '127.0.0.1';

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function start() {
  await initializeDb();
  const db = getNodeDb();
  const client = getNodeClient();
  const embedded = startEmbeddedOmniRoute();
  const runtimeOrigin = embedded?.origin ?? (process.env.OMNIROUTE_ORIGIN?.trim() || undefined);
  const runtimeToken = embedded?.apiKey ?? (process.env.OMNIROUTE_ORIGIN_TOKEN?.trim() || undefined);
  const authenticateGateway = createNodeGatewayAuthenticator(db, process.env.GATEWAY_AUTH_TOKEN);
  const rateLimiter = createNodeRateLimiter(client, {
    maxRequests: positiveInteger(process.env.GATEWAY_RATE_LIMIT_PER_MINUTE, 60),
  });

  app.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 302));

  if (fs.existsSync('./dist')) {
    app.use('/assets/*', serveStatic({ root: './dist' }));
    app.use('/*', serveStatic({ root: './dist' }));
    app.get('*', serveStatic({ root: './dist', path: 'index.html' }));
  }

  const bindings: AppBindings = {
    db,
    BOOTSTRAP_SECRET: process.env.BOOTSTRAP_SECRET?.trim() || undefined,
    OMNIROUTE_ORIGIN: runtimeOrigin,
    OMNIROUTE_ORIGIN_TOKEN: runtimeToken,
    ENVIRONMENT: process.env.ENVIRONMENT?.trim() || (process.env.VERCEL ? 'vercel' : 'local'),
    INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL?.trim() || undefined,
    INITIAL_ADMIN_USERNAME: process.env.INITIAL_ADMIN_USERNAME?.trim() || undefined,
    INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || undefined,
    AUTH_ALLOW_WEAK_INITIAL_ADMIN_PASSWORD: process.env.AUTH_ALLOW_WEAK_INITIAL_ADMIN_PASSWORD?.trim() || undefined,
    AUTH_SESSION_TTL_HOURS: process.env.AUTH_SESSION_TTL_HOURS?.trim() || undefined,
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE?.trim() || undefined,
    AUTH_OAUTH_AUTO_PROVISION: process.env.AUTH_OAUTH_AUTO_PROVISION?.trim() || undefined,
    AUTH_ALLOWED_EMAIL_DOMAINS: process.env.AUTH_ALLOWED_EMAIL_DOMAINS?.trim() || undefined,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.trim() || undefined,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || undefined,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID?.trim() || undefined,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || undefined,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID?.trim() || undefined,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || undefined,
    MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID?.trim() || undefined,
  };

  const server = serve({
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) {
        return handleGatewayRequest(request, {
          authenticate: authenticateGateway,
          rateLimiter,
          origin: runtimeOrigin,
          originToken: runtimeToken,
          recordTelemetry: (event) => recordNodeGatewayTelemetry(db, event),
        });
      }
      return app.fetch(request, bindings);
    },
    port: PORT,
    hostname: HOST,
  }, (info) => {
    console.log(`OmniRoute Edge server listening on http://${HOST}:${info.port}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    embedded?.child?.kill(signal);
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start OmniRoute Edge server', error);
  process.exitCode = 1;
});
