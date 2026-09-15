import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('local data verifier reports provider credential placement and API-key metadata counts without revealing secrets', () => {
  const output = execFileSync(process.execPath, ['--no-warnings', 'scripts/verify-local-data.mjs'], { encoding: 'utf8' });
  assert.match(output, /provider credentials configured: \d+\/\d+/);
  assert.match(output, /gateway API-key metadata: \d+/);
  assert.match(output, /admin API-key metadata: \d+/);
  assert.equal(output.includes('key_hash'), false);
  assert.equal(output.includes('api_key_encrypted'), false);
});
