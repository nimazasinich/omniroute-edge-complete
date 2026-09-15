import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const pageMarkers = {
  'src/components/ProvidersView.tsx': ['Provider inventory', 'Data source', 'Observed traffic', 'Authoritative health'],
  'src/components/ModelsView.tsx': ['Model inventory', 'Provider filter', 'Data source', 'Cost metadata'],
  'src/components/RoutingRulesView.tsx': ['Routing authority', 'OmniRoute connectivity', 'Management API', 'Observed request outcomes'],
  'src/components/SecurityPoliciesView.tsx': ['Enforcement inventory', 'Observed security evidence', 'Deployment readiness'],
  'src/components/FirewallView.tsx': ['Security Event Explorer', 'Severity', 'Action', 'No local prompt firewall'],
  'src/components/LogsView.tsx': ['Request Logs', 'Data source', 'Request status', 'No observed request logs'],
  'src/components/TracesView.tsx': ['Request Traces', 'Data source', 'Correlation', 'No observed traces'],
  'src/components/AnalyticsView.tsx': ['Analytics', 'Data source', 'Observed requests', 'No observed analytics data'],
  'src/components/AlertsView.tsx': ['Operational Alerts', 'Data source', 'request-derived', 'Alerts unavailable'],
  'src/components/AuditLogView.tsx': ['Audit Log', 'Data source', 'admin action', 'No audit events'],
  'src/components/ApiKeysView.tsx': ['Gateway API Keys', 'Zero-Exposure Key Policy', 'Data source', 'one-time'],
  'src/components/SettingsView.tsx': ['OmniRoute Connectivity', 'Capability Matrix', 'Telemetry Sources', 'Read-only'],
};

test('every secondary surface exposes its truthful data/source contract', async () => {
  for (const [path, markers] of Object.entries(pageMarkers)) {
    const source = await readFile(path, 'utf8');
    for (const marker of markers) assert.ok(source.includes(marker), `${path} must contain ${marker}`);
  }
});

test('metrics is a dedicated purpose-built page and route', async () => {
  await access('src/components/MetricsView.tsx');
  const metrics = await readFile('src/components/MetricsView.tsx', 'utf8');
  const app = await readFile('src/App.tsx', 'utf8');
  for (const marker of ['Metrics', 'Local Node runtime', 'Observed request volume', 'Data source']) {
    assert.ok(metrics.includes(marker), `MetricsView must contain ${marker}`);
  }
  assert.ok(app.includes("import { MetricsView } from './components/MetricsView';"));
  assert.ok(app.includes('path="/metrics" element={<MetricsView data={data} />}'));
  assert.equal(app.includes('path="/metrics" element={<AnalyticsView data={data} />}'), false);
});

test('secondary surfaces do not hard-code known screenshot/demo operational values', async () => {
  const sources = await Promise.all(Object.keys(pageMarkers).map((path) => readFile(path, 'utf8')));
  for (const forbidden of ['1.24M', '99.98%', '2,847', '682 ms', '6.8GB', 'Dynamic (40/25/20/10/5)', 'Active Shield']) {
    assert.equal(sources.join('\n').includes(forbidden), false, `must not hard-code ${forbidden}`);
  }
});
