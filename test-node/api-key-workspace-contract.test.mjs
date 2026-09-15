import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('API key workspace distinguishes database inventory counts from authorized key-list access', async () => {
  const app = await readFile('src/App.tsx', 'utf8');
  const keys = await readFile('src/components/ApiKeysView.tsx', 'utf8');
  assert.ok(app.includes('<ApiKeysView data={data} />'), 'API key workspace must receive the already-loaded dashboard/readiness state');
  assert.ok(keys.includes('Database credential records'), 'workspace must expose the database inventory count');
  assert.ok(keys.includes('Admin authorization required'), 'workspace must distinguish locked metadata from an empty database');
  assert.ok(keys.includes("fetchAdmin('/api/admin/keys'"), 'actual key metadata list must remain behind admin authorization');
  assert.equal(keys.includes("fetch('/api/keys'"), false, 'key metadata must not be moved to an unauthenticated public endpoint');
});
