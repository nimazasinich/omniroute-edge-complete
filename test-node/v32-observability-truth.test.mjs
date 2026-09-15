import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('logs page exposes only observed request facts and nullable usage/cost', async () => {
  const source = await read('src/components/LogsView.tsx');
  for (const marker of ['Edge Request Logs', 'Observed model', 'Observed tokens', 'Observed cost', 'No observed token usage']) {
    assert.ok(source.includes(marker), `LogsView must contain ${marker}`);
  }
  for (const forbidden of ['Immutable log record', 'with token counts', 'Date.now()', '(log.tokensPrompt || 0)', '(log.cost || 0).toFixed']) {
    assert.equal(source.includes(forbidden), false, `LogsView must not contain ${forbidden}`);
  }
});

test('traces page is an edge request trace, not a fabricated routing score explorer', async () => {
  const source = await read('src/components/TracesView.tsx');
  for (const marker of ['Edge Request Traces', 'Correlation ID', 'Request path', 'Observed outcome', 'OmniRoute owns provider selection and fallback']) {
    assert.ok(source.includes(marker), `TracesView must contain ${marker}`);
  }
  for (const forbidden of ['Routing Decision Traces', 'scoring trail', 'Score', 'Candidates', 'bestCandidates', 'Date.now()', 'scoring candidates']) {
    assert.equal(source.includes(forbidden), false, `TracesView must not contain ${forbidden}`);
  }
});

test('sidebar does not present legacy provider snapshot health as live network health', async () => {
  const source = await read('src/components/Sidebar.tsx');
  assert.equal(source.includes('readiness.healthyProviders'), false);
  assert.ok(source.includes('Inventory'));
});

test('alerts copy describes the actual request-derived source', async () => {
  const source = await read('src/components/AlertsView.tsx');
  assert.ok(source.includes('gateway request outcomes'));
  assert.equal(source.includes('provider health and security event records'), false);
});

test('traces API does not advertise candidate scoring it does not collect', async () => {
  const source = await read('src/server/app.ts');
  assert.equal(source.includes('Full explainable routing trail (candidate scoring)'), false);
  assert.ok(source.includes('Edge request trace stream'));
});

test('audit log does not invent a current timestamp when source timestamp is absent', async () => {
  const source = await read('src/components/AuditLogView.tsx');
  assert.equal(source.includes('Date.now()'), false);
  assert.ok(source.includes("'—'"), 'missing audit timestamp must render unknown');
});

test('dashboard and navigation do not label generic edge outcomes as threats, routing decisions, or an active AI firewall', async () => {
  const dashboard = await read('src/components/DashboardView.tsx');
  const sidebar = await read('src/components/Sidebar.tsx');
  for (const marker of ['Blocked Requests', 'Security Event Activity', 'Recent Edge Requests']) {
    assert.ok(dashboard.includes(marker), `DashboardView must contain ${marker}`);
  }
  for (const forbidden of ['Blocked Threats', 'AI Firewall Activity', 'Recent AI Routing Decisions']) {
    assert.equal(dashboard.includes(forbidden), false, `DashboardView must not contain ${forbidden}`);
  }
  assert.ok(sidebar.includes("name: 'Security Events'"));
  assert.ok(sidebar.includes("name: 'Routing Status'"));
  assert.equal(sidebar.includes("name: 'AI Firewall'"), false);
});

test('topology feature badges describe implemented edge capabilities instead of screenshot-only products', async () => {
  const source = await read('src/components/TopologyMap.tsx');
  for (const marker of ['Gateway Auth', 'Rate Limit', 'Origin Guard', 'D1 Telemetry', 'Request IDs', 'OmniRoute Authority']) {
    assert.ok(source.includes(marker), `TopologyMap must contain ${marker}`);
  }
  for (const forbidden of ["label: 'WAF'", "label: 'Zero Trust'", "label: 'Policy Engine'", "label: 'AI Firewall'", "label: 'Cache'", "label: 'Traffic Optimization'"]) {
    assert.equal(source.includes(forbidden), false, `TopologyMap must not claim ${forbidden}`);
  }
});

test('alerts distinguish API-unavailable from a real empty alert dataset', async () => {
  const app = await read('src/App.tsx');
  const view = await read('src/components/AlertsView.tsx');
  const types = await read('src/types.ts');
  assert.ok(app.includes("safeJson('/api/alerts', null)"));
  assert.ok(view.includes('Alerts unavailable'));
  assert.ok(types.includes('alerts?: OperationalAlert[] | null'));
});

test('header and sidebar do not invent environment, operator identity, or gateway health', async () => {
  const header = await read('src/components/Header.tsx');
  const sidebar = await read('src/components/Sidebar.tsx');
  const appShell = await read('src/components/AppShell.tsx');
  assert.ok(header.includes('Environment Unknown'));
  assert.ok(header.includes('environment?: string | null'));
  assert.equal(header.includes("host.includes('pages.dev')"), false);
  assert.equal(header.includes('<strong>Admin</strong>'), false);
  assert.ok(sidebar.includes('Gateway Status'));
  assert.ok(sidebar.includes('OmniRouteStatus'));
  assert.equal(sidebar.includes("readiness?.ready ? 'Healthy'"), false);
  assert.ok(appShell.includes('environment={environment}'));
  assert.ok(appShell.includes('omniRouteStatus={omniRouteStatus}'));
});

test('topology and header controls do not imply filtering/search capabilities they do not execute', async () => {
  const topology = await read('src/components/TopologyMap.tsx');
  const header = await read('src/components/Header.tsx');
  assert.ok(topology.includes('Observed 24h'));
  assert.equal(topology.includes("'Last 7 days'"), false);
  assert.equal(topology.includes('leftPalette'), false);
  assert.equal(topology.includes('rightPalette'), false);
  assert.ok(header.includes('Search requests, profiles, providers, models, rules...'));
  assert.ok(header.includes('handleQuickJump'));
  assert.ok(header.includes('navigate(match.path)'));
});
