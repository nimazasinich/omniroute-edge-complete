import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('local Node DB upgrades existing requests tables for V3 telemetry', async () => {
  const source = await readFile('src/server/db/node.ts', 'utf8');
  assert.ok(source.includes('PRAGMA table_info(requests)'));
  for (const column of ['path', 'correlation_id', 'status_code', 'error', 'streaming', 'observed_tokens_input', 'observed_tokens_output', 'observed_cost']) {
    assert.ok(source.includes(`ADD COLUMN ${column}`), `missing local upgrade for ${column}`);
  }
});
