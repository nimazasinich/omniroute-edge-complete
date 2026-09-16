import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

test('Vercel deployment is a direct OmniRoute container, not the legacy Vite control plane', async () => {
  assert.equal(existsSync('Dockerfile.vercel'), true, 'Dockerfile.vercel must exist');
  assert.equal(existsSync('runtime/vercel-omniroute-entrypoint.mjs'), true, 'Vercel OmniRoute entrypoint must exist');
  assert.equal(existsSync('vercel.json'), true, 'vercel.json must exist');

  const dockerfile = await readFile('Dockerfile.vercel', 'utf8');
  const entrypoint = await readFile('runtime/vercel-omniroute-entrypoint.mjs', 'utf8');
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));

  assert.match(dockerfile, /FROM node:24/);
  assert.match(dockerfile, /omniroute@3\.8\.50/);
  assert.doesNotMatch(dockerfile, /npm run build/);
  assert.doesNotMatch(dockerfile, /server\.js/);
  assert.match(dockerfile, /vercel-omniroute-entrypoint\.mjs/);

  assert.match(entrypoint, /INITIAL_PASSWORD/);
  assert.match(entrypoint, /JWT_SECRET/);
  assert.match(entrypoint, /API_KEY_SECRET/);
  assert.match(entrypoint, /STORAGE_ENCRYPTION_KEY/);
  assert.match(entrypoint, /OMNIROUTE_SERVER_HOST/);
  assert.match(entrypoint, /REQUIRE_API_KEY/);
  assert.match(entrypoint, /AUTH_COOKIE_SECURE/);
  assert.match(entrypoint, /serve/);
  assert.match(entrypoint, /--no-open/);
  assert.match(entrypoint, /process\.env\.PORT/);

  assert.equal(config.fluid, true);
  assert.equal(config.services.omniroute.runtime, 'container');
  assert.equal(config.services.omniroute.entrypoint, 'Dockerfile.vercel');
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: { service: 'omniroute' } }]);
});

test('legacy Node/Turso control plane remains in source but is not the Vercel entrypoint', async () => {
  const dockerfile = await readFile('Dockerfile.vercel', 'utf8');
  const server = await readFile('server.ts', 'utf8');
  const db = await readFile('src/server/db/node.ts', 'utf8');

  assert.match(server, /handleGatewayRequest/);
  assert.match(db, /TURSO_DATABASE_URL/);
  assert.doesNotMatch(dockerfile, /CMD\s*\["node",\s*"server\.js"\]/);
  assert.doesNotMatch(dockerfile, /OMNIROUTE_EMBEDDED=true/);
});
