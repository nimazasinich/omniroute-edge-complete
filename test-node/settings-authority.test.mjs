import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('../src/components/SettingsView.tsx', import.meta.url), 'utf8');
const types = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');

test('settings view does not claim a local routing engine or inline firewall', () => {
  for (const forbidden of [
    'Smart Router Scoring Weights',
    'Health & Uptime Influence',
    'Failover Attempts',
    'Provider Degraded Threshold',
    'Zero Trust AI Firewall',
    'health.ts',
    '3 max',
    '100% Normalized',
  ]) {
    assert.equal(settings.includes(forbidden), false, `unexpected legacy claim: ${forbidden}`);
  }
  assert.match(settings, /OmniRoute/i);
  assert.match(settings, /read-only|read only/i);
});

test('dashboard data no longer carries obsolete local router settings type', () => {
  assert.equal(types.includes('export interface RouterSettings'), false);
  assert.equal(types.includes('settings?: RouterSettings'), false);
});
