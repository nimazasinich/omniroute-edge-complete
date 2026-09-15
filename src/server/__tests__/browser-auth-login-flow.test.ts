import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import app from '../app';
import { createTestDb } from '../db/node';

const clients: Array<{ close(): void }> = [];

afterEach(() => {
  while (clients.length) clients.pop()?.close();
});

function cookieValue(header: string, name: string): string {
  const match = header.match(new RegExp(`(?:^|,\\s*)${name}=([^;,]+)`));
  if (!match?.[1]) throw new Error(`Missing ${name} cookie`);
  return decodeURIComponent(match[1]);
}

describe('browser admin password login flow', () => {
  it('provisions the configured first admin by username and establishes a readable session', async () => {
    const { db, client } = await createTestDb();
    clients.push(client);

    const password = `Aa1!${crypto.randomUUID()}`;
    const bindings = {
      db,
      ENVIRONMENT: 'test',
      INITIAL_ADMIN_EMAIL: 'admin@example.test',
      INITIAL_ADMIN_USERNAME: 'admin',
      INITIAL_ADMIN_PASSWORD: password,
      AUTH_COOKIE_SECURE: 'false',
    };

    const login = await app.fetch(new Request('http://test.local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password }),
    }), bindings);

    expect(login.status).toBe(200);
    const loginBody = await login.json() as { user?: { username?: string; email?: string; role?: string } };
    expect(loginBody.user).toMatchObject({
      username: 'admin',
      email: 'admin@example.test',
      role: 'admin',
    });

    const setCookie = login.headers.get('set-cookie') ?? '';
    const sessionToken = cookieValue(setCookie, 'dw_session');
    const csrfToken = cookieValue(setCookie, 'dw_csrf');
    const cookieHeader = `dw_session=${encodeURIComponent(sessionToken)}; dw_csrf=${encodeURIComponent(csrfToken)}`;

    const session = await app.fetch(new Request('http://test.local/api/auth/session', {
      headers: { Cookie: cookieHeader },
    }), bindings);
    expect(session.status).toBe(200);
    const sessionBody = await session.json() as { user?: { username?: string; role?: string } };
    expect(sessionBody.user).toMatchObject({ username: 'admin', role: 'admin' });

    const status = await app.fetch(new Request('http://test.local/api/auth/status', {
      headers: { Cookie: cookieHeader },
    }), bindings);
    expect(status.status).toBe(200);
    const statusBody = await status.json() as { authenticated?: boolean; bootstrapRequired?: boolean };
    expect(statusBody.authenticated).toBe(true);
    expect(statusBody.bootstrapRequired).toBe(false);
  });
});
