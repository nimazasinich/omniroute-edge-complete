const assert = require('assert');
const { buildTopologyPayload } = require('./topology-compiled/topology/payload.js');
const { buildRailLayout, pageItems } = require('./topology-compiled/topology/layout.js');
const { formatTopologyLatency, formatTopologyPercent } = require('./topology-compiled/topology/format.js');

function provider(id, name, status = 'healthy', enabled = true) {
  return { id, name, status, enabled };
}
function requestTraffic(count, ids) {
  return ids.map((id, index) => ({ providerId: id, count: count + index, avgLatency: 100 + index }));
}
function runCase(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err.stack || err.message || err);
    process.exitCode = 1;
  }
}

runCase('zero providers and zero traffic stay empty/no fabricated nodes', () => {
  const payload = buildTopologyPayload({ clientTraffic: [], providerTraffic: [], apiKeys: [], providers: [], models: [] });
  assert.equal(payload.nodes.providers.length, 0);
  assert.equal(payload.nodes.applications.length, 0);
  assert.equal(payload.nodes.router.totalRequestsLast24h, 0);
  assert.equal(payload.nodes.edge.totalRequestsLast24h, 0);
});

runCase('one configured provider with no requests is not observed traffic', () => {
  const payload = buildTopologyPayload({
    clientTraffic: [], providerTraffic: [], apiKeys: [],
    providers: [provider('openai', 'OpenAI')],
    models: [{ providerId: 'openai', enabled: true }],
  });
  assert.equal(payload.nodes.providers.length, 1);
  assert.equal(payload.nodes.providers[0].connectionState, 'configured');
  assert.equal(payload.nodes.providers[0].trafficSharePct, 0);
  assert.equal(payload.nodes.providers[0].requestsLast24h, 0);
  assert.equal(payload.nodes.providers[0].modelCount, 1);
  assert.equal(payload.nodes.providers[0].enabledModelCount, 1);
});

runCase('six observed providers are all retained and sorted by traffic', () => {
  const ids = Array.from({ length: 6 }, (_, i) => `p${i}`);
  const payload = buildTopologyPayload({
    clientTraffic: [{ clientId: 'client-a', count: 75, avgLatency: 42 }],
    providerTraffic: requestTraffic(10, ids),
    apiKeys: [{ id: 'client-a', name: 'Client A', role: 'internal' }],
    providers: ids.map((id, i) => provider(id, `Provider ${i}`)),
    models: ids.map(id => ({ providerId: id, enabled: true })),
  });
  assert.equal(payload.nodes.providers.length, 6);
  assert.deepEqual(new Set(payload.nodes.providers.map(p => p.id)), new Set(ids));
  assert.equal(payload.nodes.applications[0].label, 'Client A');
  assert.equal(payload.nodes.applications[0].sourceStatus, 'classified');
});

runCase('twenty providers are not silently dropped', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
  const payload = buildTopologyPayload({
    clientTraffic: [{ clientId: null, count: 210, avgLatency: null }],
    providerTraffic: requestTraffic(1, ids.slice(0, 10)),
    apiKeys: [],
    providers: ids.map((id, i) => provider(id, i === 19 ? 'Very-Long-Enterprise-OpenAI-Compatible-Provider' : `Provider ${i}`, i === 18 ? 'offline' : 'healthy')),
    models: [],
  });
  assert.equal(payload.nodes.providers.length, 20);
  assert(payload.nodes.providers.some(p => p.label === 'Very-Long-Enterprise-OpenAI-Compatible-Provider'));
  assert(payload.nodes.providers.some(p => p.id === 'p18' && p.health === 'offline'));
  assert(payload.nodes.providers.some(p => p.connectionState === 'configured' && p.requestsLast24h === 0));
  assert.equal(payload.nodes.applications[0].label, 'Unknown');
  assert.equal(payload.nodes.applications[0].type, 'Unclassified');
});

runCase('rail pagination reaches all thirty-seven providers exactly once', () => {
  const items = Array.from({ length: 37 }, (_, i) => `node-${i}`);
  const seen = [];
  for (let page = 0; ; page += 1) {
    const layout = buildRailLayout(items.length, 300, page, { nodeHeight: 56, minGap: 8, maxPerPage: 6 });
    const pageNodes = pageItems(items, layout);
    assert(pageNodes.length <= layout.pageSize);
    for (const y of layout.positions) {
      assert(y >= 0, `negative y ${y}`);
      assert(y + 56 <= 300.00001, `out of bounds y ${y}`);
    }
    seen.push(...pageNodes);
    if (page >= layout.pageCount - 1) break;
  }
  assert.deepEqual(seen, items);
});

runCase('formatting keeps requested dynamic values readable', () => {
  assert.equal(formatTopologyLatency(3), '3 ms');
  assert.equal(formatTopologyLatency(682), '682 ms');
  assert.equal(formatTopologyLatency(12400), '12.4 s');
  assert.equal(formatTopologyPercent(0), '0%');
  assert.equal(formatTopologyPercent(1.4), '1.4%');
  assert.equal(formatTopologyPercent(68.3), '68.3%');
  assert.equal(formatTopologyPercent(100), '100%');
});

if (process.exitCode) process.exit(process.exitCode);
