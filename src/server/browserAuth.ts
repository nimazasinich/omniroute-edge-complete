import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authLoginAttempts, authSessions, authUsers } from './db/schema';
import type { AppDb } from './db/types';

export type AuthUserRow = typeof authUsers.$inferSelect;
export type AuthSessionRow = typeof authSessions.$inferSelect;

export interface BrowserAuthConfig {
  BOOTSTRAP_SECRET?: string;
  INITIAL_ADMIN_EMAIL?: string;
  INITIAL_ADMIN_USERNAME?: string;
  INITIAL_ADMIN_PASSWORD?: string;
  AUTH_ALLOW_WEAK_INITIAL_ADMIN_PASSWORD?: string;
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

export const SESSION_COOKIE = 'dw_session';
export const CSRF_COOKIE = 'dw_csrf';
export const OAUTH_STATE_COOKIE = 'dw_oauth_state';
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;

export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeUsername(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 64) return 'Username must be between 3 and 64 characters.';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(username)) return 'Username may contain lowercase letters, numbers, dots, underscores, and hyphens.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters.';
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (classes < 3) return 'Password must use at least three of: lowercase, uppercase, number, symbol.';
  return null;
}

export function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function hashOpaque(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(prefix = ''): string {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

export function sessionTtlMs(config: BrowserAuthConfig): number {
  const hours = Number.parseInt(config.AUTH_SESSION_TTL_HOURS ?? '12', 10);
  const bounded = Number.isFinite(hours) ? Math.min(Math.max(hours, 1), 168) : 12;
  return bounded * 60 * 60 * 1000;
}

export function shouldUseSecureCookie(config: BrowserAuthConfig, requestUrl: string): boolean {
  if (config.AUTH_COOKIE_SECURE?.trim().toLowerCase() === 'false') return false;
  if (config.AUTH_COOKIE_SECURE?.trim().toLowerCase() === 'true') return true;
  return new URL(requestUrl).protocol === 'https:';
}

function cookieBase(maxAgeSeconds: number, secure: boolean): string {
  return `Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export function sessionCookie(value: string, ttlMs: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; ${cookieBase(Math.floor(ttlMs / 1000), secure)}`;
}

export function csrfCookie(value: string, ttlMs: number, secure: boolean): string {
  return `${CSRF_COOKIE}=${encodeURIComponent(value)}; ${cookieBase(Math.floor(ttlMs / 1000), secure)}`;
}

export function oauthStateCookie(value: string, secure: boolean): string {
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}; HttpOnly; ${cookieBase(600, secure)}`;
}

export function clearSessionCookies(secure: boolean): string[] {
  const suffix = `Path=/; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
  return [
    `${SESSION_COOKIE}=; HttpOnly; ${suffix}`,
    `${CSRF_COOKIE}=; ${suffix}`,
  ];
}

export function publicUser(user: AuthUserRow | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    loginMethod: user.oauthProvider || (user.passwordHash ? 'password' : 'external'),
    lastLoginAt: user.lastLoginAt,
  };
}

export async function createUser(db: AppDb, input: { email: string; username?: string | null; displayName?: string; password?: string | null; oauthProvider?: string | null; oauthSubject?: string | null }): Promise<AuthUserRow> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes('@')) throw new Error('A valid email address is required.');
  const username = input.username == null || input.username === '' ? null : normalizeUsername(input.username);
  if (username) {
    const usernameError = validateUsername(username);
    if (usernameError) throw new Error(usernameError);
  }
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;
  const now = Date.now();
  const id = uuidv4();
  await db.insert(authUsers).values({
    id,
    email,
    username,
    displayName: input.displayName?.trim() || email.split('@')[0] || 'Administrator',
    passwordHash,
    role: 'admin',
    status: 'active',
    oauthProvider: input.oauthProvider ?? null,
    oauthSubject: input.oauthSubject ?? null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
  const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, id) });
  if (!user) throw new Error('Failed to create authentication user.');
  return user;
}

export async function findUserByIdentifier(db: AppDb, value: unknown): Promise<AuthUserRow | null> {
  const identifier = String(value ?? '').trim();
  if (!identifier) return null;
  if (identifier.includes('@')) {
    const email = normalizeEmail(identifier);
    return (await db.query.authUsers.findFirst({ where: eq(authUsers.email, email) })) ?? null;
  }
  const username = normalizeUsername(identifier);
  if (validateUsername(username)) return null;
  return (await db.query.authUsers.findFirst({ where: eq(authUsers.username, username) })) ?? null;
}

export function matchesInitialAdminIdentifier(config: BrowserAuthConfig, value: unknown, password: string): boolean {
  const initialEmail = normalizeEmail(config.INITIAL_ADMIN_EMAIL);
  const initialPassword = config.INITIAL_ADMIN_PASSWORD ?? '';
  if (!initialEmail || !initialEmail.includes('@') || !initialPassword || !safeEqual(password, initialPassword)) return false;

  const identifier = String(value ?? '').trim();
  if (!identifier) return false;
  if (identifier.includes('@')) return safeEqual(normalizeEmail(identifier), initialEmail);

  const initialUsername = normalizeUsername(config.INITIAL_ADMIN_USERNAME);
  if (!initialUsername || validateUsername(initialUsername)) return false;
  return safeEqual(normalizeUsername(identifier), initialUsername);
}

export async function ensureInitialAdmin(db: AppDb, config: BrowserAuthConfig, identifier: string, password: string): Promise<AuthUserRow | null> {
  if (!matchesInitialAdminIdentifier(config, identifier, password)) return null;
  const initialEmail = normalizeEmail(config.INITIAL_ADMIN_EMAIL);
  const existing = await db.query.authUsers.findFirst({ where: eq(authUsers.email, initialEmail) });
  if (existing) return existing;
  const initialPassword = config.INITIAL_ADMIN_PASSWORD ?? '';
  const error = validatePassword(initialPassword);
  const allowWeakInitialPassword = config.AUTH_ALLOW_WEAK_INITIAL_ADMIN_PASSWORD?.trim().toLowerCase() === 'true';
  if (error && !allowWeakInitialPassword) throw new Error(`INITIAL_ADMIN_PASSWORD is not acceptable: ${error}`);
  const configuredUsername = normalizeUsername(config.INITIAL_ADMIN_USERNAME);
  const username = configuredUsername && !validateUsername(configuredUsername) ? configuredUsername : null;
  return createUser(db, { email: initialEmail, username, displayName: 'Administrator', password: initialPassword });
}

export async function createSession(db: AppDb, userId: string, config: BrowserAuthConfig, userAgent?: string | null) {
  const rawToken = randomToken('dw_s_');
  const rawCsrf = randomToken('dw_c_');
  const now = Date.now();
  const ttlMs = sessionTtlMs(config);
  await db.insert(authSessions).values({
    id: uuidv4(),
    userId,
    tokenHash: hashOpaque(rawToken),
    csrfHash: hashOpaque(rawCsrf),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + ttlMs,
    userAgent: userAgent?.slice(0, 512) || null,
  });
  return { rawToken, rawCsrf, ttlMs, expiresAt: now + ttlMs };
}

export async function findSession(db: AppDb, cookieHeader: string | null | undefined) {
  const rawToken = parseCookies(cookieHeader)[SESSION_COOKIE];
  if (!rawToken) return null;
  const tokenHash = hashOpaque(rawToken);
  const session = await db.query.authSessions.findFirst({ where: eq(authSessions.tokenHash, tokenHash) });
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    await db.delete(authSessions).where(eq(authSessions.id, session.id));
    return null;
  }
  const user = await db.query.authUsers.findFirst({ where: eq(authUsers.id, session.userId) });
  if (!user || user.status !== 'active') return null;
  if (Date.now() - session.lastSeenAt > 5 * 60 * 1000) {
    await db.update(authSessions).set({ lastSeenAt: Date.now() }).where(eq(authSessions.id, session.id));
  }
  return { user, session, rawToken };
}

export async function verifyCsrf(session: AuthSessionRow, cookieHeader: string | null | undefined, headerToken: string | null | undefined): Promise<boolean> {
  if (!headerToken) return false;
  const cookieToken = parseCookies(cookieHeader)[CSRF_COOKIE];
  if (!cookieToken || !safeEqual(cookieToken, headerToken)) return false;
  return safeEqual(hashOpaque(headerToken), session.csrfHash);
}

export async function revokeSession(db: AppDb, cookieHeader: string | null | undefined): Promise<void> {
  const rawToken = parseCookies(cookieHeader)[SESSION_COOKIE];
  if (!rawToken) return;
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashOpaque(rawToken)));
}

export async function revokeUserSessions(db: AppDb, userId: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.userId, userId));
}

export async function loginRateState(db: AppDb, identifier: string) {
  const emailHash = hashOpaque(identifier);
  const since = Date.now() - LOGIN_WINDOW_MS;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(authLoginAttempts).where(and(
    eq(authLoginAttempts.emailHash, emailHash),
    eq(authLoginAttempts.success, false),
    gte(authLoginAttempts.attemptedAt, since),
  ));
  const failures = Number(rows[0]?.count ?? 0);
  return { allowed: failures < LOGIN_FAILURE_LIMIT, failures, retryAfterMs: failures < LOGIN_FAILURE_LIMIT ? 0 : LOGIN_WINDOW_MS };
}

export async function recordLoginAttempt(db: AppDb, identifier: string, success: boolean): Promise<void> {
  await db.insert(authLoginAttempts).values({ id: uuidv4(), emailHash: hashOpaque(identifier), attemptedAt: Date.now(), success });
}

export function oauthProviderConfig(config: BrowserAuthConfig, provider: string) {
  if (provider === 'google') return { configured: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET), clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET };
  if (provider === 'github') return { configured: !!(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET), clientId: config.GITHUB_CLIENT_ID, clientSecret: config.GITHUB_CLIENT_SECRET };
  if (provider === 'microsoft') return { configured: !!(config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET), clientId: config.MICROSOFT_CLIENT_ID, clientSecret: config.MICROSOFT_CLIENT_SECRET };
  return { configured: false, clientId: undefined, clientSecret: undefined };
}

export function allowedOAuthEmail(config: BrowserAuthConfig, email: string): boolean {
  if (config.AUTH_OAUTH_AUTO_PROVISION?.trim().toLowerCase() !== 'true') return false;
  const allowed = (config.AUTH_ALLOWED_EMAIL_DOMAINS ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return false;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return allowed.includes(domain);
}
