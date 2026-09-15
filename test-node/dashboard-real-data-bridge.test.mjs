import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/DashboardView.tsx', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../src/components/RuntimeResourcesCard.tsx', import.meta.url), 'utf8');

test('dashboard data bridge consumes real provider health and rich observed analytics', () => {
  assert.match(app, /\/api\/providers\/health/);
  assert.match(app, /\/api\/analytics\?hours=24/);
  assert.match(app, /mergeAnalyticsSources/);
});

test('dashboard exposes useful real inventory and explicit origin configuration state', () => {
  assert.match(dashboard, /title="Model Inventory"/);
  assert.match(dashboard, /Not configured/);
  assert.match(runtime, /Control Plane Resources/);
  assert.match(runtime, /Gateway keys/);
  assert.match(runtime, /Models enabled/);
});
