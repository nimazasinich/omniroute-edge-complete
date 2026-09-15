import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('canonical UI does not expose local provider edit modal', async () => {
  const app = await readFile('src/App.tsx', 'utf8');
  assert.equal(app.includes('EditProviderModal'), false);
  assert.equal(app.includes('openEditModal'), false);
});
