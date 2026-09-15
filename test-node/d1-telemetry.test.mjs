import test from 'node:test';
import assert from 'node:assert/strict';
import { recordGatewayTelemetry } from '../src/edge/d1Telemetry.ts';

test('D1 gateway telemetry stores edge facts without inventing provider/model', async () => {
  let query = '';
  let values = [];
  const db = {
    prepare(sql) {
      query = sql;
      return {
        bind(...args) { values = args; return this; },
        async run() { return {}; },
      };
    },
  };
  await recordGatewayTelemetry(db, {
    id: 'r1', timestamp: 1000, clientId: 'k1', path: '/v1/chat/completions', correlationId: 'c1',
    statusCode: 200, latencyMs: 42, outcome: 'success', error: null, streaming: true,
  });
  assert.match(query, /INSERT INTO requests/);
  assert.equal(values[4], null, 'requested_model stays unknown');
  assert.equal(values[5], null, 'selected_model stays unknown');
  assert.equal(values[6], null, 'provider_id stays unknown');
  assert.equal(values[13], '/v1/chat/completions');
  assert.equal(values[14], 'c1');
  assert.equal(values[17], 1);
});

test('D1 gateway telemetry labels pre-origin edge failures truthfully', async () => {
  async function routingReasonFor(error) {
    let values = [];
    const db = { prepare() { return { bind(...args) { values = args; return this; }, async run() { return {}; } }; } };
    await recordGatewayTelemetry(db, {
      id: `r-${error}`, timestamp: 1000, clientId: 'k1', path: '/v1/models', correlationId: 'c1',
      statusCode: 503, latencyMs: 0, outcome: 'error', error, streaming: false,
    });
    return values[11];
  }
  assert.equal(await routingReasonFor('origin_not_ready'), 'edge-origin-guard');
  assert.equal(await routingReasonFor('rate_limit_not_ready'), 'edge-rate-limit-config');
});
