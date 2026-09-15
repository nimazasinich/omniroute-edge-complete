import type { GatewayTelemetryEvent } from './gatewayCore.ts';

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  run(): Promise<unknown>;
}

export interface D1TelemetryBinding {
  prepare(query: string): D1PreparedStatementLike;
}

function requestTypeFromPath(path: string): string {
  if (path === '/v1/chat/completions') return 'chat';
  if (path === '/v1/embeddings') return 'embeddings';
  if (path === '/v1/models') return 'models';
  return 'api';
}

export async function recordGatewayTelemetry(db: D1TelemetryBinding, event: GatewayTelemetryEvent): Promise<void> {
  const requestType = requestTypeFromPath(event.path);
  const routingReason = event.outcome === 'rate_limited'
    ? 'edge-rate-limit'
    : event.error === 'origin_not_ready'
      ? 'edge-origin-guard'
      : event.error === 'rate_limit_not_ready'
        ? 'edge-rate-limit-config'
        : 'omniroute';
  const status = event.outcome === 'success' ? 'success' : event.outcome === 'rate_limited' ? 'blocked' : 'error';

  await db.prepare(`
    INSERT INTO requests (
      id, timestamp, client_id, request_type,
      requested_model, selected_model, provider_id,
      latency_ms, tokens_input, tokens_output, cost,
      routing_reason, status,
      path, correlation_id, status_code, error, streaming,
      observed_tokens_input, observed_tokens_output, observed_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.id,
    event.timestamp,
    event.clientId,
    requestType,
    event.requestedModel ?? null,
    null,
    null,
    event.latencyMs,
    0,
    0,
    0,
    routingReason,
    status,
    event.path,
    event.correlationId,
    event.statusCode,
    event.error,
    event.streaming ? 1 : 0,
    null,
    null,
    null,
  ).run();
}
