import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

test('Vercel container packages pinned OmniRoute runtime', async () => {
  assert.equal(existsSync('Dockerfile.vercel'), true, 'Dockerfile.vercel must exist');
  assert.equal(existsSync('vercel.json'), true, 'vercel.json must exist');
  const dockerfile = await readFile('Dockerfile.vercel', 'utf8');
  const config = await readFile('vercel.json', 'utf8');
  assert.match(dockerfile, /FROM node:24/);
  assert.match(dockerfile, /omniroute@3\.8\.50/);
  assert.match(dockerfile, /OMNIROUTE_EMBEDDED=true/);
  assert.match(dockerfile, /node server\.js/);
  assert.equal(JSON.parse(config).fluid, true);
});

test('Node database supports Turso without removing local SQLite fallback', async () => {
  const source = await readFile('src/server/db/node.ts', 'utf8');
  assert.match(source, /TURSO_DATABASE_URL/);
  assert.match(source, /TURSO_AUTH_TOKEN/);
  assert.match(source, /authToken/);
  assert.match(source, /SQLITE_DB_PATH/);
});

test('Node entrypoint starts embedded OmniRoute and owns the Vercel v1 gateway path', async () => {
  assert.equal(existsSync('runtime/embedded-omniroute.mjs'), true, 'embedded runtime module must exist');
  const server = await readFile('server.ts', 'utf8');
  const embedded = await readFile('runtime/embedded-omniroute.mjs', 'utf8');
  const gateway = await readFile('src/edge/gatewayCore.ts', 'utf8');
  assert.match(server, /startEmbeddedOmniRoute/);
  assert.match(server, /handleGatewayRequest/);
  assert.match(server, /\/v1/);
  assert.match(embedded, /127\.0\.0\.1/);
  assert.match(embedded, /20129/);
  assert.match(embedded, /20130/);
  assert.match(embedded, /OMNIROUTE_READY_TIMEOUT_MS/);
  assert.doesNotMatch(embedded, /onrender\.com/);
  assert.match(gateway, /duplex/);
});
