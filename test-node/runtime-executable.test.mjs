import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRuntimeEnvironment, resolveRuntimeExecutable } from '../runtime/resolve-runtime-executable.mjs';

test('Render native origin resolves OmniRoute from the configured writable npm prefix', () => {
  assert.equal(
    resolveRuntimeExecutable({ platform: 'linux', npmPrefix: '/opt/render/project/src/.npm-global' }),
    '/opt/render/project/src/.npm-global/bin/omniroute',
  );
});

test('origin launcher preserves normal PATH lookup when no npm prefix is configured', () => {
  assert.equal(resolveRuntimeExecutable({ platform: 'linux' }), 'omniroute');
  assert.equal(resolveRuntimeExecutable({ platform: 'win32' }), 'omniroute.cmd');
});

test('OmniRoute child never inherits the public Render PORT', () => {
  const runtimeEnv = buildRuntimeEnvironment({
    parentEnv: { PORT: '10000', KEEP_ME: 'yes' },
    dataDir: '/data',
    storageKey: 'storage',
    apiKey: 'api',
    dashboardPort: 20129,
    apiPort: 20130,
  });
  assert.equal(Object.hasOwn(runtimeEnv, 'PORT'), false);
  assert.equal(runtimeEnv.KEEP_ME, 'yes');
  assert.equal(runtimeEnv.DASHBOARD_PORT, '20129');
  assert.equal(runtimeEnv.API_PORT, '20130');
  assert.equal(runtimeEnv.OMNIROUTE_SERVER_HOST, '127.0.0.1');
  assert.equal(runtimeEnv.API_HOST, '127.0.0.1');
});
