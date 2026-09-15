import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('provider and model pages do not expose local routing mutations', async () => {
  const providers = await readFile('src/components/ProvidersView.tsx', 'utf8');
  const models = await readFile('src/components/ModelsView.tsx', 'utf8');
  for (const forbidden of ["method: 'PUT'", '/providers/ping', 'Configure upstream models', 'onEditProvider']) {
    assert.equal(providers.includes(forbidden), false, `ProvidersView must not contain ${forbidden}`);
  }
  assert.equal(models.includes('onConfigureProvider'), false, 'ModelsView must not offer local provider configuration');
  assert.ok((providers + models).includes('Read-only'));
  assert.ok((providers + models).includes('OmniRoute'));
});
