import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('V3.2 exposes explicit system capability and OmniRoute status APIs', async () => {
  const app = await readFile('src/server/app.ts', 'utf8');
  const worker = await readFile('src/worker.ts', 'utf8');
  const types = await readFile('src/types.ts', 'utf8');
  const frontend = await readFile('src/App.tsx', 'utf8');

  assert.ok(app.includes("app.get('/api/system/capabilities'"));
  assert.ok(app.includes("app.get('/api/omniroute/status'"));
  assert.ok(app.includes("/v1/models"), 'status probe must use the configured OpenAI-compatible model surface');
  assert.ok(app.includes('AbortController') || app.includes('AbortSignal.timeout'), 'status probe must be bounded');
  assert.ok(worker.includes('OMNIROUTE_ORIGIN: env.OMNIROUTE_ORIGIN'));
  assert.ok(types.includes('OperationalCapabilities'));
  assert.ok(types.includes('OmniRouteStatus'));
  assert.ok(frontend.includes("'/api/v2/system/capabilities'"));
  assert.ok(frontend.includes("'/api/v2/system/status'"));
});

test('capability contract explicitly denies unsupported local control planes', async () => {
  const app = await readFile('src/server/app.ts', 'utf8');
  for (const marker of [
    'providerManagement: false',
    'modelManagement: false',
    'routingRulesManagement: false',
    'promptFirewall: false',
    "routingAuthority: 'omniroute'",
  ]) {
    assert.ok(app.includes(marker), `missing capability marker ${marker}`);
  }
});
