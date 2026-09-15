import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('browser auth backend persists users and revocable sessions', async () => {
  const schema = await read('src/server/db/schema.ts');
  const migration = await read('drizzle/0004_browser_auth.sql');
  const app = await read('src/server/app.ts');

  for (const marker of ['authUsers', 'authSessions']) assert.ok(schema.includes(marker), `schema missing ${marker}`);
  for (const table of ['auth_users', 'auth_sessions']) assert.ok(migration.includes(table), `migration missing ${table}`);
  for (const route of [
    "/api/auth/status",
    "/api/auth/session",
    "/api/auth/permissions",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/bootstrap",
    "/api/auth/password",
  ]) assert.ok(app.includes(route), `backend missing ${route}`);

  assert.ok(app.includes('HttpOnly'), 'session cookie must be HttpOnly');
  assert.ok(app.includes('SameSite=Lax'), 'session cookie must be SameSite=Lax');
  for (const marker of ['createSession(', 'findSession(', 'revokeSession(']) assert.ok(app.includes(marker), `backend missing revocable-session operation ${marker}`);
});

test('frontend uses real backend auth flow before dashboard access', async () => {
  const app = await read('src/App.tsx');
  const login = await read('src/components/DreamWorkerAuthScreen.tsx');
  const loading = await read('src/components/DreamWorkerLoadingScreen.tsx');
  const client = await read('src/auth/browserSession.ts');
  const header = await read('src/components/Header.tsx');

  for (const marker of ['ProtectedRoute', 'AuthProvider', '/signin', '/connecting']) {
    assert.ok(app.includes(marker), `App.tsx missing ${marker}`);
  }
  assert.ok(login.includes('loginWithPassword'), 'login form must call backend login');
  assert.equal(login.includes("setTimeout(() =>"), false, 'login must not fake success with a timer');
  for (const marker of ['checkSession', 'loadWorkspace', 'checkPermissions']) {
    assert.ok(loading.includes(marker), `loading flow missing ${marker}`);
  }
  assert.ok(client.includes("credentials: 'same-origin'"), 'browser auth requests must send session cookie');
  assert.ok(header.includes('logout'), 'account menu must expose logout');
});

test('social login buttons are capability-gated, never fake-success navigation', async () => {
  const login = await read('src/components/DreamWorkerAuthScreen.tsx');
  assert.ok(login.includes('authProviders'), 'login must load provider capability state');
  assert.ok(login.includes('startOAuth'), 'configured OAuth providers must start backend OAuth');
  assert.equal(login.includes("onClick={() => navigate('/connecting')}"), false, 'social buttons must not fake OAuth by navigating directly');
});

test('cookie-authenticated mutations require CSRF proof', async () => {
  const app = await read('src/server/app.ts');
  const schema = await read('src/server/db/schema.ts');
  const client = await read('src/auth/browserSession.ts').catch(() => '');
  assert.ok(schema.includes('csrfHash'), 'sessions must persist a CSRF proof hash');
  assert.ok(app.includes('X-CSRF-Token'), 'server must verify X-CSRF-Token for cookie mutations');
  assert.ok(client.includes('X-CSRF-Token'), 'browser client must send X-CSRF-Token for mutations');
});

test('OAuth account linking accepts only provider-verified email identities', async () => {
  const app = await read('src/server/app.ts');
  assert.ok(app.includes('profile.email_verified !== true'), 'Google OAuth must reject unverified email identities');
  assert.ok(app.includes("emails.find((item) => item.primary && item.verified)?.email"), 'GitHub OAuth must prefer a verified primary email');
  assert.equal(app.includes('normalizeEmail(profile.email || emails.find'), false, 'GitHub OAuth must not trust an unverified profile email before verified email records');
});
