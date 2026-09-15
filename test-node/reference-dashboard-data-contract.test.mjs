import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('reference dashboard search copy and provider summary remain faithful without hiding full inventory', async () => {
  const header = await readFile('src/components/Header.tsx', 'utf8');
  const providerCard = await readFile('src/components/ProviderHealthCard.tsx', 'utf8');
  assert.ok(header.includes('Search requests, profiles, providers, models, rules...'), 'header search must match the supplied reference-board wording');
  assert.ok(providerCard.includes('Showing') && providerCard.includes('providers.length'), 'six-row dashboard card must disclose that it is a summary when more providers exist');
  assert.ok(providerCard.includes('View details'), 'dashboard provider summary must link to the complete provider workspace');
});

test('topology copy does not claim unavailable live/global facts', async () => {
  const topology = await readFile('src/components/TopologyMap.tsx', 'utf8');
  assert.equal(topology.includes('Live view of all traffic flow, security controls, and provider routing across the Cloudflare edge.'), false,
    'topology subtitle must not claim global live routing when running from local/snapshot evidence');
  assert.ok(topology.includes('Observed edge traffic'), 'topology must describe its observed/request-inventory evidence');
});
