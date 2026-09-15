import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('frontend does not present the decorative login/loading flow as authentication', async () => {
  const app = await readFile('src/App.tsx', 'utf8');
  assert.equal(app.includes('LoginView'), false);
  assert.equal(app.includes('LoadingView'), false);
  assert.equal(app.includes('path="/login"'), false);
  assert.equal(app.includes('path="/loading"'), false);
});
