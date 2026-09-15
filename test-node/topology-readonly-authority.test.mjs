import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('topology workspace is read-only and does not claim local scoring/firewall execution', async () => {
  const source = await readFile('src/components/TopologyView.tsx', 'utf8');
  for (const forbidden of ['onOpenEditModal', 'Dynamic (40/25/20/10/5)', 'Active Shield', 'encrypted API key injection', 'calculated token usage']) {
    assert.equal(source.includes(forbidden), false, `TopologyView must not contain ${forbidden}`);
  }
  assert.ok(source.includes('OmniRoute'));
  assert.ok(source.includes('Read-only') || source.includes('read-only'));
});
