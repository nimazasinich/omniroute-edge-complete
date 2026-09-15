import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('provider read model exposes credential presence without exposing credential material', async () => {
  const server = await readFile('src/server/app.ts', 'utf8');
  const healthStart = server.indexOf("app.get('/api/providers/health'");
  const healthEnd = server.indexOf("app.get('/api/routing/history'", healthStart);
  const healthRoute = server.slice(healthStart, healthEnd);
  assert.match(healthRoute, /hasApiKey:\s*Boolean\(apiKeyEncrypted \|\| p\.hasApiKey\)/,
    'public provider read model must expose only a boolean credential-presence marker');
  assert.equal(healthRoute.includes('apiKeyEncrypted: apiKeyEncrypted'), false,
    'provider read model must never return encrypted credential material');
});

test('provider workspace makes credential presence visible and keeps the full inventory reachable', async () => {
  const providers = await readFile('src/components/ProvidersView.tsx', 'utf8');
  const models = await readFile('src/components/ModelsView.tsx', 'utf8');
  assert.ok(providers.includes('Credential'), 'provider table must have a credential column');
  assert.ok(providers.includes('provider.hasApiKey'), 'provider rows must render the safe credential-presence field');
  assert.equal(providers.includes('data.providers.slice('), false, 'provider workspace must not silently truncate inventory');
  assert.equal(models.includes('data.models.slice('), false, 'model workspace must not silently truncate inventory');
});
