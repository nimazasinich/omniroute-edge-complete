import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expectations = {
  'src/components/ProvidersView.tsx': ['Provider inventory', 'Search providers', 'Data source', 'Observed traffic'],
  'src/components/ModelsView.tsx': ['Model inventory', 'Search models', 'Provider filter', 'Data source'],
  'src/components/RoutingRulesView.tsx': ['Routing authority', 'OmniRoute connectivity', 'Observed request outcomes', 'Management API'],
  'src/components/SecurityPoliciesView.tsx': ['Enforcement inventory', 'Gateway authentication', 'Rate limiting', 'Origin validation'],
  'src/components/FirewallView.tsx': ['Security event explorer', 'Severity', 'Action', 'No local prompt firewall'],
  'src/components/SettingsView.tsx': ['OmniRoute Connectivity', 'Capability Matrix', 'Telemetry Sources'],
};

test('V3.2 completes every major control and observability surface', async () => {
  for (const [path, markers] of Object.entries(expectations)) {
    const source = await readFile(path, 'utf8');
    for (const marker of markers) assert.ok(source.includes(marker), `${path} must contain ${marker}`);
  }
});

test('completed UI still forbids fabricated screenshot metrics and local router claims', async () => {
  const paths = Object.keys(expectations).concat(['src/components/DashboardView.tsx']);
  const combined = (await Promise.all(paths.map((p) => readFile(p, 'utf8')))).join('\n');
  for (const forbidden of ['1.24M', '99.98%', '2,847', '682 ms', 'Dynamic (40/25/20/10/5)', 'Active Shield']) {
    assert.equal(combined.includes(forbidden), false, `must not hard-code ${forbidden}`);
  }
});
