import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRuntimeExecutable } from '../runtime/resolve-runtime-executable.mjs';

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
