import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser admin auth never falls back to a default secret', async () => {
  const source = await readFile('src/auth/adminAuth.ts', 'utf8');
  assert.equal(source.includes('admin_secret'), false);
  assert.ok(source.includes("|| ''") || source.includes("?? ''"));
});
