import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('local database bootstrap never hard-codes admin_secret', async () => {
  const source = await readFile('src/server/db/node.ts', 'utf8');
  assert.equal(source.includes('admin_secret'), false);
  assert.ok(source.includes('BOOTSTRAP_SECRET') || source.includes('DEV_ADMIN_TOKEN'));
});
