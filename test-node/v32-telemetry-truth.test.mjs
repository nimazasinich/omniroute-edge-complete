import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractRequestedModel } from '../src/edge/gatewayCore.ts';

test('requested model is extracted only from a real bounded JSON request', async () => {
  const request = new Request('https://edge.test/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '42' },
    body: JSON.stringify({ model: 'gpt-real-from-request', messages: [] }),
  });
  assert.equal(await extractRequestedModel(request), 'gpt-real-from-request');

  const nonJson = new Request('https://edge.test/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'model=fake'
  });
  assert.equal(await extractRequestedModel(nonJson), null);
});

test('telemetry schema has nullable observed token/cost fields instead of treating legacy zero as truth', async () => {
  const schema = await readFile('src/server/db/schema.ts', 'utf8');
  const migration = await readFile('drizzle/0003_observed_metrics.sql', 'utf8');
  const telemetry = await readFile('src/edge/d1Telemetry.ts', 'utf8');
  const api = await readFile('src/server/app.ts', 'utf8');

  for (const field of ['observedTokensInput', 'observedTokensOutput', 'observedCost']) {
    assert.ok(schema.includes(field), `schema missing ${field}`);
  }
  for (const col of ['observed_tokens_input', 'observed_tokens_output', 'observed_cost']) {
    assert.ok(migration.includes(col), `migration missing ${col}`);
  }
  assert.ok(telemetry.includes('event.requestedModel ?? null'));
  assert.ok(api.includes('observedTokensInput'));
  assert.ok(api.includes('observedCost'));
});
