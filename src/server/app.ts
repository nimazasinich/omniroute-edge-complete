import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { providers, models, apiKeys, policies, requests, securityEvents, auditLog, authUsers, authSessions } from './db/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { AppDb } from './db/types';
import { buildTopologyPayload } from '../topology/payload';
import { validateOmniRouteOrigin } from '../edge/gatewayCore';
import { systemV2 } from '../api/v2/system';
import { catalogV2 } from '../api/v2/catalog';
import { combosV2 } from '../api/v2/combos';
import { routingV2 } from '../api/v2/routing';
import { operationsV2 } from '../api/v2/operations';
import { observabilityV2 } from '../api/v2/observability';
import {
  CSRF_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  allowedOAuthEmail,
  clearSessionCookies,
  createSession,
  createUser,
  csrfCookie,
  ensureInitialAdmin,
  findSession,
  findUserByIdentifier,
  hashOpaque,
  loginRateState,
  normalizeEmail,
  normalizeUsername,
  oauthProviderConfig,
  oauthStateCookie,
  parseCookies,
  publicUser,
  randomToken,
  recordLoginAttempt,
  revokeSession,
  revokeUserSessions,
  safeEqual,
  sessionCookie,
  shouldUseSecureCookie,
  validatePassword,
  validateUsername,
  verifyCsrf,
  type AuthSessionRow,
  type AuthUserRow,
  type BrowserAuthConfig,
} from './browserAuth';

// ── Runtime contract ────────────────────────────────────────────────────────
// app.ts never imports a concrete database driver. The Node entrypoint (server.ts)
// and the Cloudflare entrypoint (worker.ts) each construct an `AppDb` for their own
// runtime and hand it in as a Hono Binding named `db`; a tiny middleware below copies
// it onto the request context so every handler can do `const db = c.get('db')`.
export interface AppBindings extends BrowserAuthConfig {
  db: AppDb;
  OMNIROUTE_ORIGIN?: string;
  OMNIROUTE_ORIGIN_TOKEN?: string;
  ENVIRONMENT?: string;
}

type ApiKeyRow = typeof apiKeys.$inferSelect;
interface AdminActor { id: string | null; name: string; role: string; source: 'api-key' | 'browser-session'; }

export interface AppVariables {
  db: AppDb;
  apiKey?: ApiKeyRow;
  authUser?: AuthUserRow;
  authSession?: AuthSessionRow;
  adminActor?: AdminActor;
}

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();
app.use('*', cors());
app.use('*', async (c, next) => {
  c.set('db', c.env.db);
  await next();
});

// ─── Admin auth ────────────────────────────────────────────────────────────
// Public gateway authentication lives only in src/worker.ts. The Hono app
// authenticates admin/control-plane requests exclusively through hashed D1 keys.
async function authenticateAdmin(db: AppDb, token: string | undefined) {
  if (!token) return null;
  const prefix = token.slice(0, 12);
  const candidates = await db.query.apiKeys.findMany({
    where: and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.revoked, false)),
  });
  for (const candidate of candidates) {
    if (candidate.role !== 'admin') continue;
    if (await bcrypt.compare(token, candidate.keyHash)) {
      await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, candidate.id));
      return candidate;
    }
  }
  return null;
}

async function getBrowserSessionContext(c: any) {
  const db: AppDb = c.get('db');
  return findSession(db, c.req.header('Cookie'));
}

async function requireBrowserSession(c: any) {
  const found = await getBrowserSessionContext(c);
  if (!found) return null;
  c.set('authUser', found.user);
  c.set('authSession', found.session);
  c.set('adminActor', { id: found.user.id, name: found.user.displayName, role: found.user.role, source: 'browser-session' });
  return found;
}

async function requireBrowserCsrf(c: any, session: AuthSessionRow): Promise<boolean> {
  return verifyCsrf(session, c.req.header('Cookie'), c.req.header('X-CSRF-Token'));
}

const adminAuthMiddleware = async (c: any, next: any) => {
  const db: AppDb = c.get('db');
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const key = await authenticateAdmin(db, authHeader.slice(7));
    if (!key) return c.json({ error: 'Forbidden' }, 403);
    c.set('apiKey', key);
    c.set('adminActor', { id: key.id, name: key.name, role: key.role, source: 'api-key' });
    await next();
    return;
  }

  const found = await requireBrowserSession(c);
  if (!found || found.user.role !== 'admin') return c.json({ error: 'Authentication required' }, 401);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method.toUpperCase())) {
    if (!(await requireBrowserCsrf(c, found.session))) return c.json({ error: 'Invalid CSRF proof' }, 403);
  }
  await next();
};

// ─── Audit log helper — every admin mutation writes one entry here ─────────
async function writeAudit(db: AppDb, actor: AdminActor | undefined, action: string, resourceType: string, resourceId: string | null, detail: string) {
  await db.insert(auditLog).values({
    id: uuidv4(),
    timestamp: Date.now(),
    actorKeyId: actor?.id ?? null,
    actorName: actor?.name ?? 'unknown',
    action,
    resourceType,
    resourceId,
    detail,
  });
}

function appendSetCookie(c: any, value: string) {
  c.header('Set-Cookie', value, { append: true });
}

function setSessionCookies(c: any, session: { rawToken: string; rawCsrf: string; ttlMs: number }, secure: boolean) {
  appendSetCookie(c, sessionCookie(session.rawToken, session.ttlMs, secure));
  appendSetCookie(c, csrfCookie(session.rawCsrf, session.ttlMs, secure));
}

function authError(c: any, status: number, code: string, message: string) {
  return c.json({ error: { code, message } }, status as any);
}

function authProviderState(env: AppBindings) {
  return {
    google: oauthProviderConfig(env, 'google').configured,
    github: oauthProviderConfig(env, 'github').configured,
    microsoft: oauthProviderConfig(env, 'microsoft').configured,
  };
}

app.get('/api/health', (c) => c.json({ status: 'ok' }));


// ════════════════════════════════════════════════════════════════════════
// BROWSER ADMIN AUTH — password/OAuth login + revocable server sessions
// ════════════════════════════════════════════════════════════════════════
app.get('/api/auth/status', async (c) => {
  const db = c.get('db');
  const session = await findSession(db, c.req.header('Cookie'));
  const users = await db.query.authUsers.findMany({ limit: 1 });
  return c.json({
    authenticated: Boolean(session),
    user: publicUser(session?.user),
    bootstrapRequired: users.length === 0,
    providers: authProviderState(c.env),
    sessionExpiresAt: session?.session.expiresAt ?? null,
  });
});

app.get('/api/auth/session', async (c) => {
  const found = await requireBrowserSession(c);
  if (!found) return authError(c, 401, 'AUTH_REQUIRED', 'Sign in to continue.');
  return c.json({ user: publicUser(found.user), expiresAt: found.session.expiresAt });
});

app.get('/api/auth/permissions', async (c) => {
  const found = await requireBrowserSession(c);
  if (!found) return authError(c, 401, 'AUTH_REQUIRED', 'Sign in to continue.');
  const permissions = found.user.role === 'admin'
    ? ['dashboard.read', 'providers.read', 'models.read', 'keys.read', 'keys.write', 'policies.read', 'audit.read', 'settings.read', 'settings.write']
    : ['dashboard.read'];
  return c.json({ role: found.user.role, permissions });
});

app.post('/api/auth/login', async (c) => {
  const db = c.get('db');
  const body = await c.req.json().catch(() => ({})) as { identifier?: unknown; email?: unknown; password?: unknown };
  const rawIdentifier = String(body.identifier ?? body.email ?? '').trim();
  const identifier = rawIdentifier.includes('@') ? normalizeEmail(rawIdentifier) : normalizeUsername(rawIdentifier);
  const password = String(body.password ?? '');
  if (!identifier || !password) return authError(c, 400, 'INVALID_INPUT', 'Username or email and password are required.');

  const rate = await loginRateState(db, identifier);
  if (!rate.allowed) return authError(c, 429, 'TOO_MANY_ATTEMPTS', 'Too many failed sign-in attempts. Try again later.');

  let user = await findUserByIdentifier(db, identifier);
  if (!user && identifier.includes('@')) user = await ensureInitialAdmin(db, c.env, identifier, password);
  const valid = Boolean(user?.passwordHash) && await bcrypt.compare(password, user!.passwordHash!);
  if (!user || !valid || user.status !== 'active') {
    await recordLoginAttempt(db, identifier, false);
    return authError(c, 401, 'INVALID_CREDENTIALS', 'Username/email or password is incorrect.');
  }

  await recordLoginAttempt(db, identifier, true);
  const now = Date.now();
  await db.update(authUsers).set({ lastLoginAt: now, updatedAt: now }).where(eq(authUsers.id, user.id));
  const freshUser = await db.query.authUsers.findFirst({ where: eq(authUsers.id, user.id) }) ?? user;
  const session = await createSession(db, user.id, c.env, c.req.header('User-Agent'));
  setSessionCookies(c, session, shouldUseSecureCookie(c.env, c.req.url));
  return c.json({ user: publicUser(freshUser), expiresAt: session.expiresAt });
});

app.post('/api/auth/logout', async (c) => {
  const db = c.get('db');
  const found = await findSession(db, c.req.header('Cookie'));
  const secure = shouldUseSecureCookie(c.env, c.req.url);
  if (found && !(await requireBrowserCsrf(c, found.session))) return authError(c, 403, 'CSRF_INVALID', 'Invalid CSRF proof.');
  await revokeSession(db, c.req.header('Cookie'));
  for (const cookie of clearSessionCookies(secure)) appendSetCookie(c, cookie);
  return c.body(null, 204);
});

app.post('/api/auth/bootstrap', async (c) => {
  const db = c.get('db');
  const existing = await db.query.authUsers.findMany({ limit: 1 });
  if (existing.length) return authError(c, 409, 'BOOTSTRAP_CLOSED', 'Administrator setup is already complete.');
  const expected = c.env.BOOTSTRAP_SECRET?.trim() ?? '';
  const supplied = c.req.header('X-Bootstrap-Secret')?.trim() ?? '';
  if (!expected) return authError(c, 503, 'BOOTSTRAP_NOT_CONFIGURED', 'BOOTSTRAP_SECRET is not configured.');
  if (!supplied || !safeEqual(expected, supplied)) return authError(c, 403, 'BOOTSTRAP_FORBIDDEN', 'Bootstrap secret is invalid.');
  const body = await c.req.json().catch(() => ({})) as { email?: unknown; username?: unknown; password?: unknown; displayName?: unknown };
  const email = normalizeEmail(body.email);
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? '');
  const passwordError = validatePassword(password);
  const usernameError = validateUsername(username);
  if (!email.includes('@')) return authError(c, 400, 'INVALID_EMAIL', 'A valid administrator email is required.');
  if (usernameError) return authError(c, 400, 'INVALID_USERNAME', usernameError);
  if (await db.query.authUsers.findFirst({ where: eq(authUsers.username, username) })) return authError(c, 409, 'USERNAME_TAKEN', 'That administrator username is already in use.');
  if (passwordError) return authError(c, 400, 'WEAK_PASSWORD', passwordError);
  const user = await createUser(db, { email, username, password, displayName: String(body.displayName ?? '').trim() || 'Administrator' });
  const session = await createSession(db, user.id, c.env, c.req.header('User-Agent'));
  setSessionCookies(c, session, shouldUseSecureCookie(c.env, c.req.url));
  return c.json({ user: publicUser(user), expiresAt: session.expiresAt }, 201);
});

app.post('/api/auth/password', async (c) => {
  const db = c.get('db');
  const found = await requireBrowserSession(c);
  if (!found) return authError(c, 401, 'AUTH_REQUIRED', 'Sign in to continue.');
  if (!(await requireBrowserCsrf(c, found.session))) return authError(c, 403, 'CSRF_INVALID', 'Invalid CSRF proof.');
  const body = await c.req.json().catch(() => ({})) as { currentPassword?: unknown; newPassword?: unknown };
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');
  if (found.user.passwordHash && !(await bcrypt.compare(currentPassword, found.user.passwordHash))) {
    return authError(c, 403, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return authError(c, 400, 'WEAK_PASSWORD', passwordError);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(authUsers).set({ passwordHash, updatedAt: Date.now() }).where(eq(authUsers.id, found.user.id));
  await revokeUserSessions(db, found.user.id);
  const session = await createSession(db, found.user.id, c.env, c.req.header('User-Agent'));
  setSessionCookies(c, session, shouldUseSecureCookie(c.env, c.req.url));
  const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, found.user.id) }) ?? found.user;
  return c.json({ user: publicUser(user), expiresAt: session.expiresAt });
});

function oauthAuthorizeUrl(provider: string, clientId: string, redirectUri: string, state: string, tenantId?: string) {
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, access_type: 'online', prompt: 'select_account' }).toString();
    return url.toString();
  }
  if (provider === 'github') {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: 'read:user user:email', state }).toString();
    return url.toString();
  }
  if (provider === 'microsoft') {
    const tenant = tenantId?.trim() || 'common';
    const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid profile email User.Read', state, response_mode: 'query' }).toString();
    return url.toString();
  }
  throw new Error('Unsupported OAuth provider');
}

app.get('/api/auth/oauth/:provider/start', async (c) => {
  const provider = c.req.param('provider');
  const config = oauthProviderConfig(c.env, provider);
  if (!config.configured || !config.clientId) return authError(c, 404, 'OAUTH_NOT_CONFIGURED', `${provider} sign-in is not configured.`);
  const state = randomToken('dw_o_');
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/oauth/${provider}/callback`;
  appendSetCookie(c, oauthStateCookie(state, shouldUseSecureCookie(c.env, c.req.url)));
  return c.redirect(oauthAuthorizeUrl(provider, config.clientId, redirectUri, state, c.env.MICROSOFT_TENANT_ID));
});

async function exchangeOAuthCode(provider: string, code: string, redirectUri: string, config: { clientId?: string; clientSecret?: string }, tenantId?: string) {
  if (!config.clientId || !config.clientSecret) throw new Error('OAuth provider is not configured.');
  if (provider === 'google') {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
    const token = await tokenRes.json() as any;
    if (!tokenRes.ok || !token.access_token) throw new Error('Google token exchange failed.');
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileRes.json() as any;
    if (!profileRes.ok) throw new Error('Google profile lookup failed.');
    if (profile.email_verified !== true) throw new Error('Google account email is not verified.');
    return { subject: String(profile.sub ?? ''), email: normalizeEmail(profile.email), displayName: String(profile.name ?? profile.email ?? 'Administrator') };
  }
  if (provider === 'github') {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri }) });
    const token = await tokenRes.json() as any;
    if (!tokenRes.ok || !token.access_token) throw new Error('GitHub token exchange failed.');
    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'DreamWorker-Control-Plane' };
    const [profileRes, emailsRes] = await Promise.all([fetch('https://api.github.com/user', { headers }), fetch('https://api.github.com/user/emails', { headers })]);
    const profile = await profileRes.json() as any;
    const emails = await emailsRes.json().catch(() => []) as any[];
    const email = normalizeEmail(
      emails.find((item) => item.primary && item.verified)?.email
      || emails.find((item) => item.verified)?.email,
    );
    if (!profileRes.ok || !profile.id) throw new Error('GitHub profile lookup failed.');
    if (!email) throw new Error('GitHub did not return a verified email address.');
    return { subject: String(profile.id), email, displayName: String(profile.name ?? profile.login ?? email ?? 'Administrator') };
  }
  if (provider === 'microsoft') {
    const tenant = tenantId?.trim() || 'common';
    const tokenRes = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: 'openid profile email User.Read' }) });
    const token = await tokenRes.json() as any;
    if (!tokenRes.ok || !token.access_token) throw new Error('Microsoft token exchange failed.');
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileRes.json() as any;
    if (!profileRes.ok || !profile.id) throw new Error('Microsoft profile lookup failed.');
    return { subject: String(profile.id), email: normalizeEmail(profile.mail || profile.userPrincipalName), displayName: String(profile.displayName ?? profile.mail ?? 'Administrator') };
  }
  throw new Error('Unsupported OAuth provider.');
}

app.get('/api/auth/oauth/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const config = oauthProviderConfig(c.env, provider);
  if (!config.configured) return c.redirect('/signin?error=oauth_not_configured');
  const state = c.req.query('state') ?? '';
  const code = c.req.query('code') ?? '';
  const expectedState = parseCookies(c.req.header('Cookie'))[OAUTH_STATE_COOKIE] ?? '';
  if (!state || !expectedState || !safeEqual(state, expectedState) || !code) return c.redirect('/signin?error=oauth_state');
  try {
    const redirectUri = `${new URL(c.req.url).origin}/api/auth/oauth/${provider}/callback`;
    const profile = await exchangeOAuthCode(provider, code, redirectUri, config, c.env.MICROSOFT_TENANT_ID);
    if (!profile.email) return c.redirect('/signin?error=oauth_email');
    const db = c.get('db');
    let user = await db.query.authUsers.findFirst({ where: eq(authUsers.email, profile.email) });
    if (!user) {
      if (!allowedOAuthEmail(c.env, profile.email)) return c.redirect('/signin?error=oauth_not_allowed');
      user = await createUser(db, { email: profile.email, displayName: profile.displayName, oauthProvider: provider, oauthSubject: profile.subject });
    } else if (user.status !== 'active') {
      return c.redirect('/signin?error=account_disabled');
    } else {
      await db.update(authUsers).set({ oauthProvider: provider, oauthSubject: profile.subject, lastLoginAt: Date.now(), updatedAt: Date.now() }).where(eq(authUsers.id, user.id));
    }
    const session = await createSession(db, user.id, c.env, c.req.header('User-Agent'));
    setSessionCookies(c, session, shouldUseSecureCookie(c.env, c.req.url));
    appendSetCookie(c, `${OAUTH_STATE_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${shouldUseSecureCookie(c.env, c.req.url) ? '; Secure' : ''}`);
    return c.redirect('/connecting');
  } catch {
    return c.redirect('/signin?error=oauth_failed');
  }
});

// All control-plane APIs after the auth endpoints require either a browser
// administrator session or an existing admin API key. The /v1 inference plane
// is handled separately by the Worker and keeps its gateway-key contract.
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health' || c.req.path === '/api/bootstrap' || c.req.path.startsWith('/api/auth/')) {
    await next();
    return;
  }
  const authorization = c.req.header('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const key = await authenticateAdmin(c.get('db'), authorization.slice(7));
    if (key) { await next(); return; }
  }
  const found = await findSession(c.get('db'), c.req.header('Cookie'));
  if (!found) return c.json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to access the control plane.' } }, 401);
  c.set('authUser', found.user);
  c.set('authSession', found.session);
  await next();
});

// Normalized v2 control/read API from CP10. In the merged build it inherits
// the stronger P1 browser-session/API-key boundary; non-GET browser requests also
// require CSRF through adminAuthMiddleware.
app.use('/api/v2/*', adminAuthMiddleware);
app.route('/api/v2/system', systemV2);
app.route('/api/v2', catalogV2);
app.route('/api/v2/combos', combosV2);
app.route('/api/v2/routing', routingV2);
app.route('/api/v2', operationsV2);
app.route('/api/v2/observability', observabilityV2);

app.get('/api/system/capabilities', (c) => c.json({
  routingAuthority: 'omniroute',
  providerManagement: false,
  modelManagement: false,
  routingRulesManagement: false,
  promptFirewall: false,
  gatewayAuthentication: true,
  perKeyRateLimiting: true,
  originValidation: true,
  requestTelemetry: 'd1-edge',
  providerInventorySource: 'legacy-read-model',
  modelInventorySource: 'legacy-read-model',
  securityEventSource: 'd1-observed-events',
  adminAuthSource: 'd1-hashed-admin-keys',
  environment: c.env?.ENVIRONMENT ?? null,
}));

app.get('/api/omniroute/status', async (c) => {
  const checkedAt = Date.now();
  const validation = validateOmniRouteOrigin(c.env?.OMNIROUTE_ORIGIN);
  if (!validation.ok) {
    return c.json({
      configured: false,
      reachable: null,
      checkedAt,
      originHost: null,
      probePath: '/v1/models',
      httpStatus: null,
      latencyMs: null,
      modelCount: null,
      modelIds: [],
      error: `origin_${validation.reason}`,
    });
  }

  const target = new URL('/v1/models', validation.origin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const startedAt = Date.now();
  try {
    const headers = new Headers({ Accept: 'application/json' });
    if (c.env?.OMNIROUTE_ORIGIN_TOKEN?.trim()) {
      headers.set('Authorization', `Bearer ${c.env.OMNIROUTE_ORIGIN_TOKEN.trim()}`);
    }
    const response = await fetch(target, { method: 'GET', headers, redirect: 'manual', signal: controller.signal });
    const latencyMs = Math.max(0, Date.now() - startedAt);
    let modelIds: string[] = [];
    if (response.ok) {
      const payload = await response.json().catch(() => null) as { data?: Array<{ id?: unknown }> } | null;
      if (Array.isArray(payload?.data)) {
        modelIds = payload.data
          .map((item) => typeof item?.id === 'string' ? item.id : null)
          .filter((id): id is string => Boolean(id))
          .slice(0, 100);
      }
    }
    return c.json({
      configured: true,
      reachable: true,
      checkedAt,
      originHost: validation.origin.host,
      probePath: '/v1/models',
      httpStatus: response.status,
      latencyMs,
      modelCount: response.ok ? modelIds.length : null,
      modelIds,
      error: response.ok ? null : `probe_http_${response.status}`,
    });
  } catch (error) {
    const message = error instanceof Error
      ? (error.name === 'AbortError' ? 'probe_timeout' : error.message)
      : String(error);
    return c.json({
      configured: true,
      reachable: false,
      checkedAt,
      originHost: validation.origin.host,
      probePath: '/v1/models',
      httpStatus: null,
      latencyMs: Math.max(0, Date.now() - startedAt),
      modelCount: null,
      modelIds: [],
      error: message,
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('/api/runtime', (c) => {
  const runtimeProcess = typeof process !== 'undefined' ? process : null;
  const mem = runtimeProcess?.memoryUsage?.();
  const cpu = runtimeProcess?.cpuUsage?.();
  if (!runtimeProcess || !mem || !cpu) {
    return c.json({
      available: false,
      source: 'unavailable',
      heapUsedMb: null,
      heapTotalMb: null,
      rssMb: null,
      cpuUserMs: null,
      cpuSystemMs: null,
      uptimeSeconds: null,
    });
  }
  return c.json({
    available: true,
    source: 'node-process',
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    cpuUserMs: Math.round(cpu.user / 1000),
    cpuSystemMs: Math.round(cpu.system / 1000),
    uptimeSeconds: runtimeProcess.uptime ? Math.round(runtimeProcess.uptime()) : null,
  });
});

app.get('/api/readiness', async (c) => {
  const db = c.get('db');
  const since = Date.now() - DAY_MS;
  const [
    allProviders,
    allModels,
    allPolicies,
    allKeys,
    recentRequests,
    errorRows,
    blockedRows,
    lastRequest,
    lastSecurityEvent,
  ] = await Promise.all([
    db.query.providers.findMany(),
    db.query.models.findMany(),
    db.query.policies.findMany(),
    db.query.apiKeys.findMany(),
    db.select({ count: sql<number>`count(*)` }).from(requests).where(gte(requests.timestamp, since)),
    db.select({ count: sql<number>`count(*)` }).from(requests).where(and(gte(requests.timestamp, since), eq(requests.status, 'error'))),
    db.select({ count: sql<number>`count(*)` }).from(requests).where(and(gte(requests.timestamp, since), eq(requests.status, 'blocked'))),
    db.query.requests.findFirst({ orderBy: [desc(requests.timestamp)] }),
    db.query.securityEvents.findFirst({ orderBy: [desc(securityEvents.timestamp)] }),
  ]);

  const activeKeys = allKeys.filter((key) => !key.revoked);
  const adminKeys = activeKeys.filter((key) => key.role === 'admin').length;
  const gatewayKeys = activeKeys.filter((key) => key.role === 'gateway').length;
  const enabledProviders = allProviders.filter((provider) => provider.enabled);
  const healthyProviders = enabledProviders.filter((provider) => provider.healthStatus === 'healthy').length;
  const degradedProviders = enabledProviders.filter((provider) => provider.healthStatus === 'degraded').length;
  const offlineProviders = enabledProviders.filter((provider) => provider.healthStatus === 'offline').length;
  const enabledModelCount = allModels.filter((model) => model.enabled).length;
  const issues: string[] = [];

  if (adminKeys === 0) issues.push('No active local admin API key exists; bootstrap is required for app-level admin operations.');

  return c.json({
    // This endpoint reports the observability/control-plane API itself, not provider routing readiness.
    // OmniRoute is the sole routing authority and may be healthy even when this legacy read model is empty.
    ready: true,
    routingAuthority: 'omniroute',
    routingStateSource: 'legacy_read_model',
    checkedAt: Date.now(),
    adminKeys,
    gatewayKeys,
    providerCount: allProviders.length,
    enabledProviders: enabledProviders.length,
    healthyProviders,
    degradedProviders,
    offlineProviders,
    providerHealthSource: 'legacy_snapshot',
    providerHealthAuthoritative: false,
    modelCount: allModels.length,
    enabledModelCount,
    policyCount: allPolicies.length,
    requestCount24h: Number(recentRequests[0]?.count ?? 0),
    errorCount24h: Number(errorRows[0]?.count ?? 0),
    blockedCount24h: Number(blockedRows[0]?.count ?? 0),
    lastRequestAt: lastRequest?.timestamp ?? null,
    lastSecurityEventAt: lastSecurityEvent?.timestamp ?? null,
    issues,
  });
});

// ════════════════════════════════════════════════════════════════════════
// ADMIN API — provider/model/key/policy management (admin auth required)
// ════════════════════════════════════════════════════════════════════════
const adminApp = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();
adminApp.use('*', adminAuthMiddleware);


const omniRouteOwnedStateReadOnly = (c: any) => c.json({
  error: {
    type: 'omniroute_authority',
    message: 'Provider, model, routing-policy, and provider-health state is owned by OmniRoute. This dashboard surface is read-only until a real OmniRoute management API is connected.',
  },
}, 409);

// Lets the dashboard verify a pasted admin key and learn who it belongs to,
// without needing a username/password login system the schema never modeled.
adminApp.get('/whoami', async (c) => {
  const actor = c.get('adminActor');
  return c.json({ id: actor?.id ?? null, name: actor?.name ?? 'unknown', role: actor?.role ?? 'unknown', source: actor?.source ?? 'unknown' });
});

adminApp.get('/providers', async (c) => {
  const db = c.get('db');
  const all = await db.query.providers.findMany();
  return c.json(all.map(({ apiKeyEncrypted, ...rest }) => ({ ...rest, hasApiKey: !!apiKeyEncrypted })));
});

adminApp.post('/providers', omniRouteOwnedStateReadOnly);
adminApp.put('/providers/:id', omniRouteOwnedStateReadOnly);
adminApp.delete('/providers/:id', omniRouteOwnedStateReadOnly);

adminApp.get('/models', async (c) => {
  const db = c.get('db');
  const all = await db.select({
    id: models.id,
    providerId: models.providerId,
    modelName: models.modelName,
    capabilities: models.capabilities,
    contextWindow: models.contextWindow,
    inputCost: models.inputCost,
    outputCost: models.outputCost,
    enabled: models.enabled,
    providerName: providers.name,
    providerHealth: providers.healthStatus,
  }).from(models).leftJoin(providers, eq(models.providerId, providers.id));
  return c.json(all);
});

adminApp.post('/models', omniRouteOwnedStateReadOnly);
adminApp.put('/models/:id', omniRouteOwnedStateReadOnly);
adminApp.delete('/models/:id', omniRouteOwnedStateReadOnly);

adminApp.get('/policies', async (c) => {
  const rows = await c.get('db').query.policies.findMany();
  return c.json(rows.map((p) => ({ ...p, value: describePolicyConfig(String(p.type), p.config) })));
});

adminApp.post('/policies', omniRouteOwnedStateReadOnly);
adminApp.put('/policies/:id', omniRouteOwnedStateReadOnly);
adminApp.delete('/policies/:id', omniRouteOwnedStateReadOnly);

adminApp.get('/keys', async (c) => {
  const all = await c.get('db').query.apiKeys.findMany();
  return c.json(all.map(({ keyHash, ...rest }) => ({
    ...rest,
    maskedKey: rest.keyPrefix ? `${rest.keyPrefix}…` : '****',
  })));
});

adminApp.post('/keys', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const role: 'admin' | 'gateway' = body.role === 'admin' ? 'admin' : 'gateway';
  const raw = `${role === 'admin' ? 'admin' : 'sk'}_${crypto.randomBytes(32).toString('base64url')}`;
  const keyHash = await bcrypt.hash(raw, 10);
  const id = uuidv4();
  await db.insert(apiKeys).values({
    id,
    keyHash,
    keyPrefix: raw.slice(0, 12),
    name: body.name ?? 'Unnamed key',
    role,
    revoked: false,
    createdAt: Date.now(),
  });
  await writeAudit(db, c.get('adminActor'), 'create', 'api_key', id, `Issued ${role} key "${body.name ?? 'Unnamed key'}"`);
  // Raw key is returned exactly once — the server never stores or logs it again.
  return c.json({ id, name: body.name ?? 'Unnamed key', rawKey: raw, rawSecret: raw, status: 'created' });
});

adminApp.post('/keys/:id/revoke', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, id));
  await writeAudit(db, c.get('adminActor'), 'revoke', 'api_key', id, 'Revoked API key');
  return c.json({ status: 'revoked' });
});

adminApp.delete('/keys/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, id));
  await writeAudit(db, c.get('adminActor'), 'revoke', 'api_key', id, 'Revoked API key');
  return c.json({ status: 'revoked' });
});

adminApp.get('/audit-log', async (c) => {
  const db = c.get('db');
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  const entries = await db.query.auditLog.findMany({ orderBy: [desc(auditLog.timestamp)], limit });
  return c.json(entries);
});


adminApp.get('/topology', async (c) => {
  return c.json(await readTopologyPayload(c, c.get('db')));
});

adminApp.post('/providers/ping', omniRouteOwnedStateReadOnly);
adminApp.post('/providers/:id/health-check', omniRouteOwnedStateReadOnly);

app.route('/api/admin', adminApp);

// ════════════════════════════════════════════════════════════════════════
// DASHBOARD READ API — aggregated operational data, no secrets exposed.
// Kept unauthenticated deliberately: these are read-only observability views
// (no provider credentials or raw gateway/admin keys are ever returned here).
// Admin mutation routes above still require a Bearer admin key.
// ════════════════════════════════════════════════════════════════════════

function originArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'items', 'connections', 'providers', 'models', 'combos']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function normalizeOriginProvider(row: any): any {
  const runtime = row && typeof row.runtime === 'object' && row.runtime ? row.runtime : {};
  return {
    ...row,
    id: String(row?.id ?? ''),
    name: String(row?.name ?? row?.id ?? 'Unknown Provider'),
    type: String(row?.type ?? row?.provider ?? row?.providerId ?? 'unknown'),
    enabled: typeof row?.enabled === 'boolean' ? row.enabled : typeof row?.isActive === 'boolean' ? row.isActive : true,
    healthStatus: row?.healthStatus ?? row?.health ?? runtime.health ?? 'unknown',
    latencyMs: row?.latencyMs ?? runtime.latencyMs ?? null,
    successRate: row?.successRate ?? null,
    costPerToken: row?.costPerToken ?? null,
  };
}

async function fetchFromOrigin(c: any, path: string): Promise<any[]> {
  const validation = validateOmniRouteOrigin(c.env?.OMNIROUTE_ORIGIN);
  if (!validation.ok) return [];
  const target = new URL(path, validation.origin);
  const headers = new Headers({ Accept: 'application/json' });
  if (c.env?.OMNIROUTE_ORIGIN_TOKEN?.trim()) {
    headers.set('Authorization', `Bearer ${c.env.OMNIROUTE_ORIGIN_TOKEN.trim()}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(target, { method: 'GET', headers, redirect: 'manual', signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    const items = originArray(data);
    return path === '/api/providers' ? items.map(normalizeOriginProvider).filter((item) => item.id) : items;
  } catch (e) {
    console.error('Failed to fetch from origin', path, e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function describePolicyConfig(type: string, raw: unknown): string {
  const config = typeof raw === 'string' ? safeObject(raw) : (raw && typeof raw === 'object' ? raw as Record<string, unknown> : {});
  if (type.startsWith('model_') && Array.isArray(config.models)) return config.models.join(', ');
  if (type.startsWith('provider_') && Array.isArray(config.providers)) return config.providers.join(', ');
  if ('limit' in config) return String(config.limit);
  if ('requestsPerMinute' in config) return String(config.requestsPerMinute);
  return Object.keys(config).length ? JSON.stringify(config) : 'No data';
}

function safeObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function readTopologyPayload(c: any, db: AppDb) {
  const since = Date.now() - DAY_MS;

  const byClient = await db
    .select({
      clientId: requests.clientId,
      count: sql<number>`count(*)`,
      avgLatency: sql<number>`avg(${requests.latencyMs})`,
    })
    .from(requests)
    .where(gte(requests.timestamp, since))
    .groupBy(requests.clientId);

  const byProvider = await db
    .select({
      providerId: requests.providerId,
      count: sql<number>`count(*)`,
      avgLatency: sql<number>`avg(${requests.latencyMs})`,
    })
    .from(requests)
    .where(gte(requests.timestamp, since))
    .groupBy(requests.providerId);

  const [keys, liveProviders, liveModels] = await Promise.all([
    db.query.apiKeys.findMany(),
    fetchFromOrigin(c, '/api/providers'),
    fetchFromOrigin(c, '/api/models'),
  ]);
  const liveProviderHealth = liveProviders.length > 0;
  const allProviders = liveProviderHealth ? liveProviders : await db.query.providers.findMany();
  const allModels = liveModels.length > 0 ? liveModels : await db.query.models.findMany();

  return buildTopologyPayload({
    clientTraffic: byClient.map((row) => ({
      clientId: row.clientId ? String(row.clientId) : null,
      count: Number(row.count),
      avgLatency: row.avgLatency === null ? null : Number(row.avgLatency),
    })),
    providerTraffic: byProvider.map((row) => ({
      providerId: row.providerId ? String(row.providerId) : null,
      count: Number(row.count),
      avgLatency: row.avgLatency === null ? null : Number(row.avgLatency),
    })),
    apiKeys: keys.map((key) => ({ id: String(key.id), name: String(key.name), role: String(key.role) })),
    providers: allProviders.map((provider) => ({
      id: String(provider.id),
      name: String(provider.name),
      status: liveProviderHealth
        ? (provider.healthStatus ?? provider.status ?? (provider.enabled === false ? 'disabled' : null))
        : (provider.enabled === false ? 'disabled' : null),
      enabled: provider.enabled !== false,
      metadata: liveProviderHealth ? (provider.metadata ?? {}) : {},
    })),
    models: allModels.map((model) => ({
      providerId: model.providerId ? String(model.providerId) : null,
      enabled: Boolean(model.enabled),
    })),
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

app.get('/api/providers', async (c) => {
  const originProviders = await fetchFromOrigin(c, '/api/providers');
  if (originProviders.length > 0) return c.json(originProviders);
  const all = await c.get('db').query.providers.findMany();
  return c.json(all.map(({ apiKeyEncrypted, ...rest }: any) => ({
    ...rest,
    hasApiKey: Boolean(apiKeyEncrypted),
  })));
});


app.get('/api/models', async (c) => {
  const originModels = await fetchFromOrigin(c, '/api/models');
  if (originModels.length > 0) return c.json(originModels);
  const db = c.get('db');
  const rows = await db.select({
    id: models.id,
    providerId: models.providerId,
    modelName: models.modelName,
    capabilities: models.capabilities,
    contextWindow: models.contextWindow,
    inputCost: models.inputCost,
    outputCost: models.outputCost,
    enabled: models.enabled,
    providerName: providers.name,
    providerHealth: providers.healthStatus,
  }).from(models).leftJoin(providers, eq(models.providerId, providers.id));
  return c.json(rows);
});

app.get('/api/providers/health', async (c) => {
  const db = c.get('db');
  const since = Date.now() - DAY_MS;
  const originProviders = await fetchFromOrigin(c, '/api/providers');
  const authoritativeHealth = originProviders.length > 0;
  const all = authoritativeHealth ? originProviders : await db.query.providers.findMany();

  const traffic = await db
    .select({ providerId: requests.providerId, count: sql<number>`count(*)` })
    .from(requests)
    .where(gte(requests.timestamp, since))
    .groupBy(requests.providerId);
  const observedTraffic = traffic.reduce((sum, t) => sum + Number(t.count), 0);
  const totalTraffic = observedTraffic > 0 ? observedTraffic : 1;
  const trafficByProvider = new Map<string | null, number>(traffic.map((t) => [t.providerId as (string | null), Number(t.count)]));

  return c.json(all.map(({ apiKeyEncrypted, ...p }: any) => ({
    ...p,
    hasApiKey: Boolean(apiKeyEncrypted || p.hasApiKey),
    healthSource: authoritativeHealth ? 'omniroute' : 'legacy_snapshot',
    authoritativeHealth,
    // Preserve imported health values only as historical snapshot fields when the real
    // OmniRoute origin is unavailable. They must never be presented as current health.
    snapshotHealthStatus: p.healthStatus ?? null,
    snapshotLatencyMs: p.latencyMs ?? null,
    snapshotSuccessRate: p.successRate ?? null,
    healthStatus: authoritativeHealth ? (p.healthStatus ?? 'unknown') : 'unknown',
    latencyMs: authoritativeHealth ? (p.latencyMs ?? null) : null,
    successRate: authoritativeHealth ? (p.successRate ?? null) : null,
    costPerToken: authoritativeHealth ? (p.costPerToken ?? null) : null,
    requestsLast24h: trafficByProvider.get(String(p.id)) ?? 0,
    trafficSharePct: observedTraffic > 0
      ? Math.round(((trafficByProvider.get(String(p.id)) ?? 0) / totalTraffic) * 1000) / 10
      : 0,
  })));
});

app.get('/api/routing/history', async (c) => {
  const db = c.get('db');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const rows = await db
    .select({
      id: requests.id,
      timestamp: requests.timestamp,
      requestType: requests.requestType,
      requestedModel: requests.requestedModel,
      selectedModel: requests.selectedModel,
      providerId: requests.providerId,
      routingReason: requests.routingReason,
      latencyMs: requests.latencyMs,
      status: requests.status,
      statusCode: requests.statusCode,
      correlationId: requests.correlationId,
      path: requests.path,
      cost: requests.observedCost,
    })
    .from(requests)
    .orderBy(desc(requests.timestamp))
    .limit(limit);
  return c.json(rows.map((row) => ({
    ...row,
    selectedProviderId: row.providerId,
    selectedModelId: null,
    reasons: row.routingReason ? [row.routingReason] : [],
  })));
});

app.get('/api/security/events', async (c) => {
  const db = c.get('db');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const events = await db.query.securityEvents.findMany({
    orderBy: [desc(securityEvents.timestamp)],
    limit,
  });
  return c.json(events);
});

app.get('/api/topology', async (c) => {
  return c.json(await readTopologyPayload(c, c.get('db')));
});

app.get('/api/analytics', async (c) => {
  const db = c.get('db');
  const windowHours = Math.min(Math.max(Number(c.req.query('hours') ?? 24), 1), 24 * 30);
  const since = Date.now() - windowHours * 60 * 60 * 1000;

  const totals = await db
    .select({
      count: sql<number>`count(*)`,
      avgLatency: sql<number>`avg(${requests.latencyMs})`,
      tokensIn: sql<number | null>`sum(${requests.observedTokensInput})`,
      tokensOut: sql<number | null>`sum(${requests.observedTokensOutput})`,
      cost: sql<number | null>`sum(${requests.observedCost})`,
    })
    .from(requests)
    .where(gte(requests.timestamp, since));

  const byStatus = await db
    .select({ status: requests.status, count: sql<number>`count(*)` })
    .from(requests)
    .where(gte(requests.timestamp, since))
    .groupBy(requests.status);

  const byRequestType = await db
    .select({ requestType: requests.requestType, count: sql<number>`count(*)` })
    .from(requests)
    .where(gte(requests.timestamp, since))
    .groupBy(requests.requestType);

  const byProvider = await db
    .select({ providerId: requests.providerId, count: sql<number>`count(*)`, cost: sql<number | null>`sum(${requests.observedCost})`, avgLatency: sql<number>`avg(${requests.latencyMs})` })
    .from(requests)
    .where(gte(requests.timestamp, since))
    .groupBy(requests.providerId);

  const bySeverity = await db
    .select({ severity: securityEvents.severity, count: sql<number>`count(*)` })
    .from(securityEvents)
    .where(gte(securityEvents.timestamp, since))
    .groupBy(securityEvents.severity);

  // Hourly request-volume series for the trend chart, bucketed to the requested window.
  const bucketMs = windowHours <= 24 ? 60 * 60 * 1000 : DAY_MS;
  const buckets = await db
    .select({ bucket: sql<number>`(${requests.timestamp} / ${bucketMs}) * ${bucketMs}`, count: sql<number>`count(*)` })
    .from(requests)
    .where(gte(requests.timestamp, since))
    .groupBy(sql`(${requests.timestamp} / ${bucketMs})`)
    .orderBy(sql`(${requests.timestamp} / ${bucketMs})`);

  let allProviders = await fetchFromOrigin(c, '/api/providers');
  if (allProviders.length === 0) allProviders = await db.query.providers.findMany();
  const providerById = new Map(allProviders.map((p: any) => [p.id, p.name]));

  return c.json({
    windowHours,
    totalRequests: Number(totals[0]?.count ?? 0),
    avgLatencyMs: Math.round(Number(totals[0]?.avgLatency) || 0),
    totalTokens: totals[0]?.tokensIn === null && totals[0]?.tokensOut === null
      ? null
      : Number(totals[0]?.tokensIn ?? 0) + Number(totals[0]?.tokensOut ?? 0),
    tokensIn: totals[0]?.tokensIn === null || totals[0]?.tokensIn === undefined ? null : Number(totals[0].tokensIn),
    tokensOut: totals[0]?.tokensOut === null || totals[0]?.tokensOut === undefined ? null : Number(totals[0].tokensOut),
    estimatedCost: totals[0]?.cost === null || totals[0]?.cost === undefined ? null : Number(totals[0].cost),
    byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    byRequestType: byRequestType.map((r) => ({ requestType: r.requestType, count: Number(r.count) })),
    byProvider: byProvider.map((r) => ({
      providerId: r.providerId,
      providerName: r.providerId ? providerById.get(r.providerId) ?? 'Unknown' : 'Unassigned',
      count: Number(r.count),
      cost: r.cost === null || r.cost === undefined ? null : Number(r.cost),
      avgLatencyMs: Math.round(Number(r.avgLatency) || 0),
    })),
    securityBySeverity: bySeverity.map((r) => ({ severity: r.severity, count: Number(r.count) })),
    requestVolumeSeries: buckets.map((b) => ({ timestamp: Number(b.bucket), count: Number(b.count) })),
  });
});

app.get('/api/dashboard/stats', async (c) => {
  const db = c.get('db');
  const since = Date.now() - DAY_MS;

  const originProviders = await fetchFromOrigin(c, '/api/providers');
  const providerHealthAuthoritative = originProviders.length > 0;
  const allProviders = providerHealthAuthoritative ? originProviders : await db.query.providers.findMany();
  const enabledProviders = allProviders.filter((p: any) => p.enabled);
  const healthy = providerHealthAuthoritative ? enabledProviders.filter((p: any) => p.healthStatus === 'healthy').length : null;
  const degraded = providerHealthAuthoritative ? enabledProviders.filter((p: any) => p.healthStatus === 'degraded').length : null;
  const offline = providerHealthAuthoritative ? enabledProviders.filter((p: any) => p.healthStatus === 'offline').length : null;

  const totals = await db
    .select({
      count: sql<number>`count(*)`,
      avgLatency: sql<number>`avg(${requests.latencyMs})`,
      tokensIn: sql<number | null>`sum(${requests.observedTokensInput})`,
      tokensOut: sql<number | null>`sum(${requests.observedTokensOutput})`,
      cost: sql<number | null>`sum(${requests.observedCost})`,
    })
    .from(requests)
    .where(gte(requests.timestamp, since));

  const blockedThreats = await db
    .select({ count: sql<number>`count(*)` })
    .from(requests)
    .where(and(gte(requests.timestamp, since), eq(requests.status, 'blocked')));


  return c.json({
    totalRequestsLast24h: Number(totals[0]?.count ?? 0),
    activeProviders: enabledProviders.length,
    healthyProviders: healthy,
    degradedProviders: degraded,
    offlineProviders: offline,
    providerHealthSource: providerHealthAuthoritative ? 'omniroute' : 'legacy_snapshot',
    providerHealthAuthoritative,
    avgLatencyMs: Math.round(Number(totals[0]?.avgLatency) || 0),
    blockedThreatsLast24h: Number(blockedThreats[0]?.count ?? 0),
    tokenUsageLast24h: totals[0]?.tokensIn === null && totals[0]?.tokensOut === null
      ? null
      : Number(totals[0]?.tokensIn ?? 0) + Number(totals[0]?.tokensOut ?? 0),
    estimatedCostLast24h: totals[0]?.cost === null || totals[0]?.cost === undefined ? null : Number(totals[0].cost),
    networkHealthPct: null,
  });
});

// Raw per-request log stream — powers the "Logs" page. Supports simple filtering +
// cursor-free offset pagination, which is enough for an operational log viewer.
app.get('/api/logs', async (c) => {
  const db = c.get('db');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0);
  const status = c.req.query('status');
  const requestType = c.req.query('requestType');

  const conditions = [];
  if (status) conditions.push(eq(requests.status, status));
  if (requestType) conditions.push(eq(requests.requestType, requestType));

  let allProviders = await fetchFromOrigin(c, '/api/providers');
  if (allProviders.length === 0) allProviders = await db.query.providers.findMany();
  const providerById = new Map(allProviders.map((p: any) => [p.id, p.name]));
  const allKeys = await db.query.apiKeys.findMany();
  const keyById = new Map(allKeys.map((k) => [k.id, k.name]));

  const rows = await db
    .select()
    .from(requests)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(requests.timestamp))
    .limit(limit)
    .offset(offset);

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(requests)
    .where(conditions.length ? and(...conditions) : undefined);

  return c.json({
    total: Number(totalRow[0]?.count ?? 0),
    items: rows.map((r) => ({
      ...r,
      providerName: r.providerId ? providerById.get(r.providerId) ?? 'Unknown' : null,
      clientName: keyById.get(r.clientId) ?? 'Unknown client',
    })),
  });
});

// Edge request trace stream — powers the Traces page with only request lifecycle facts
// observed by this gateway. OmniRoute owns provider selection/fallback; no candidate
// scoring trail is synthesized here.
app.get('/api/traces', async (c) => {
  const db = c.get('db');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const rows = await db
    .select({
      id: requests.id,
      timestamp: requests.timestamp,
      requestType: requests.requestType,
      requestedModel: requests.requestedModel,
      selectedModel: requests.selectedModel,
      providerId: requests.providerId,
      latencyMs: requests.latencyMs,
      status: requests.status,
      statusCode: requests.statusCode,
      correlationId: requests.correlationId,
      path: requests.path,
      error: requests.error,
      streaming: requests.streaming,
      routingReason: requests.routingReason,
      cost: requests.cost,
    })
    .from(requests)
    .orderBy(desc(requests.timestamp))
    .limit(limit);

  return c.json(rows.map((row) => ({
    ...row,
    requestId: row.id,
    selectedProviderId: row.providerId,
    selectedModelId: null,
    providerName: null,
    modelName: row.selectedModel,
    reasons: row.routingReason ? [row.routingReason] : [],
    candidates: [],
  })));
});

// Operational alerts are derived only from real gateway request outcomes.
// Provider-health/failover alerts belong to OmniRoute and are not synthesized here.
app.get('/api/alerts', async (c) => {
  const db = c.get('db');
  const since = Date.now() - DAY_MS;
  const recent = await db.query.requests.findMany({
    where: gte(requests.timestamp, since),
    orderBy: [desc(requests.timestamp)],
    limit: 100,
  });

  const alerts = recent
    .filter((row) => row.status === 'error' || row.status === 'blocked')
    .map((row) => ({
      id: `request-${row.id}`,
      severity: row.statusCode && row.statusCode >= 500 ? 'high' : 'medium',
      type: row.status === 'blocked' ? 'edge_request_blocked' : 'gateway_request_error',
      title: row.status === 'blocked' ? 'Gateway request blocked' : 'Gateway request failed',
      detail: row.error ?? `HTTP ${row.statusCode ?? 'unknown'} on ${row.path ?? '/v1'}`,
      timestamp: row.timestamp,
      actionPath: '/logs',
      actionLabel: 'View Request Log',
      source: 'OmniRoute Edge',
    }));

  return c.json(alerts);
});

// Production /v1/* is intentionally handled only by src/worker.ts.
// This Hono app now serves admin and observability APIs only.

// ════════════════════════════════════════════════════════════════════════
// D1 BOOTSTRAP — one-time admin key seeding for fresh Cloudflare deployments
// Available only when zero admin keys exist.  Protected by a bootstrap secret
// set as a Cloudflare Worker secret: `wrangler secret put BOOTSTRAP_SECRET`.
// After the first admin key is created this endpoint is permanently closed
// (returns 403) for the lifetime of the database.
// ════════════════════════════════════════════════════════════════════════
app.post('/api/bootstrap', async (c) => {
  const db = c.get('db');

  // Fail closed immediately if any admin keys already exist.
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiKeys)
    .where(and(eq(apiKeys.role, 'admin'), eq(apiKeys.revoked, false)));
  if (Number(existing[0]?.count ?? 0) > 0) {
    return c.json({ error: 'Bootstrap already completed — endpoint is closed' }, 403);
  }

  // Verify the one-time bootstrap secret (env var, NOT a stored DB secret).
  const body = await c.req.json().catch(() => null);
  const providedSecret: string | undefined = body?.bootstrapSecret;
  const runtimeProcess = typeof process !== 'undefined' ? process : null;
  const envSecret: string | undefined =
    c.env?.BOOTSTRAP_SECRET ?? runtimeProcess?.env?.BOOTSTRAP_SECRET;

  if (!envSecret) {
    return c.json({ error: 'BOOTSTRAP_SECRET is not configured on this deployment' }, 503);
  }
  if (!providedSecret || providedSecret !== envSecret) {
    return c.json({ error: 'Invalid bootstrap secret' }, 403);
  }

  const name: string = body?.adminName ?? 'Default Admin';
  const rawKey = `admin_${crypto.randomBytes(32).toString('base64url')}`;
  const keyHash = await bcrypt.hash(rawKey, 10);
  const id = uuidv4();

  await db.insert(apiKeys).values({
    id,
    keyHash,
    keyPrefix: rawKey.slice(0, 12),
    name,
    role: 'admin',
    revoked: false,
    createdAt: Date.now(),
  });

  await db.insert(auditLog).values({
    id: uuidv4(),
    timestamp: Date.now(),
    actorKeyId: null,
    actorName: 'bootstrap',
    action: 'create',
    resourceType: 'api_key',
    resourceId: id,
    detail: `Bootstrap admin key created: "${name}". Endpoint is now permanently closed.`,
  });

  // Return the raw key exactly once — never stored or logged in plaintext.
  return c.json({
    status: 'bootstrapped',
    adminKeyId: id,
    adminKeyName: name,
    rawAdminKey: rawKey,
    warning: 'Store this key immediately — it will never be shown again.',
  });
});

// Provider health is owned by OmniRoute; no local direct-provider probe is registered here.

export default app;
