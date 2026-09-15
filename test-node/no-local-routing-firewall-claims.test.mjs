import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'src/components/RoutingRulesView.tsx',
  'src/components/FirewallView.tsx',
  'src/components/SecurityPoliciesView.tsx',
];

test('control-plane pages do not claim a local router or active prompt firewall', async () => {
  const source = (await Promise.all(files.map((path) => readFile(path, 'utf8')))).join('\n');
  for (const forbidden of [
    'Combined Multi-Factor v2.4',
    'Provider with highest score is selected',
    'Zero Trust Shield Active',
    '100% Intercept Rate',
    'Live Zero Trust Threat Simulator',
    'Add Security Policy',
  ]) {
    assert.equal(source.includes(forbidden), false, `active UI must not claim: ${forbidden}`);
  }
  assert.ok(source.includes('OmniRoute'), 'control pages must name OmniRoute as routing authority');
  assert.ok(source.includes('read-only') || source.includes('Read-only'), 'control pages must state read-only status');
});
