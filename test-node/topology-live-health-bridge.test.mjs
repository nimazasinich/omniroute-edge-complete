import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/server/app.ts', import.meta.url), 'utf8');
const start = app.indexOf('async function readTopologyPayload');
const end = app.indexOf('const DAY_MS', start);
const topologyReader = app.slice(start, end);

test('topology forwards live OmniRoute health but does not present snapshot health as current', () => {
  assert.ok(start >= 0 && end > start, 'readTopologyPayload block must exist');
  assert.match(topologyReader, /liveProviders/);
  assert.match(topologyReader, /liveProviderHealth/);
  assert.match(topologyReader, /provider\.healthStatus/);
  assert.match(topologyReader, /provider\.status/);
  assert.match(topologyReader, /liveProviderHealth\s*\?/);
});
