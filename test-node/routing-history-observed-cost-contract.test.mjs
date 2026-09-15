import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('routing history exposes only observed request cost when that telemetry exists', async () => {
  const source = await readFile('src/server/app.ts', 'utf8');
  const start = source.indexOf("app.get('/api/routing/history'");
  const end = source.indexOf("app.get('/api/security/events'", start);
  assert.ok(start >= 0 && end > start, 'routing history route must exist');
  const route = source.slice(start, end);
  assert.match(route, /cost:\s*requests\.observedCost/,
    'routing history must select requests.observedCost rather than omit cost or use legacy requests.cost');
  assert.doesNotMatch(route, /cost:\s*requests\.cost\b/,
    'routing history must not expose legacy default-zero cost as observed cost');
});
