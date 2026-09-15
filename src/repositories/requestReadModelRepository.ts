import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { DataProvenance, PaginationMeta, RequestIndexItem, RequestMetrics } from '../domain/platform';
import { requests } from '../server/db/schema';
import type { AppDb } from '../server/db/types';

export class RequestReadModelRepository {
  constructor(private readonly db: AppDb, private readonly environmentId: string, private readonly now: () => number = Date.now) {}

  async list(input: { limit: number; offset: number; correlationId?: string }) {
    const where = input.correlationId ? eq(requests.correlationId, input.correlationId) : undefined;
    const [rows, totals] = await Promise.all([
      this.db.select().from(requests).where(where).orderBy(desc(requests.timestamp)).limit(input.limit).offset(input.offset),
      this.db.select({ count: sql<number>`count(*)` }).from(requests).where(where),
    ]);
    const provenance = this.provenance();
    const items = rows.map((row) => normalizeRequest(row, provenance));
    const pagination: PaginationMeta = { offset: input.offset, limit: input.limit, returned: items.length, total: Number(totals[0]?.count ?? 0) };
    return { items, pagination, provenance };
  }

  async get(requestId: string) {
    const rows = await this.db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
    const provenance = this.provenance();
    return { item: rows[0] ? normalizeRequest(rows[0], provenance) : null, provenance };
  }

  async metrics(since: number): Promise<{ data: RequestMetrics; provenance: DataProvenance }> {
    const rows = await this.db.select({
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when ${requests.status} = 'success' then 1 else 0 end)`,
      error: sql<number>`sum(case when ${requests.status} = 'error' then 1 else 0 end)`,
      blocked: sql<number>`sum(case when ${requests.status} = 'blocked' then 1 else 0 end)`,
      averageDuration: sql<number | null>`avg(${requests.latencyMs})`,
      tokensInput: sql<number | null>`sum(${requests.observedTokensInput})`,
      tokensOutput: sql<number | null>`sum(${requests.observedTokensOutput})`,
      cost: sql<number | null>`sum(${requests.observedCost})`,
    }).from(requests).where(gte(requests.timestamp, since));
    const row = rows[0];
    return { data: {
      windowStart: since, windowEnd: this.now(), totalRequests: Number(row?.total ?? 0),
      successCount: Number(row?.success ?? 0), errorCount: Number(row?.error ?? 0), blockedCount: Number(row?.blocked ?? 0),
      averageDurationMs: nullableNumber(row?.averageDuration), observedTokensInput: nullableNumber(row?.tokensInput),
      observedTokensOutput: nullableNumber(row?.tokensOutput), observedCost: nullableNumber(row?.cost),
    }, provenance: this.provenance() };
  }

  private provenance(): DataProvenance {
    return { source: 'd1', authoritative: false, observedAt: this.now(), environmentId: this.environmentId,
      warnings: ['Durable request read model; OmniRoute remains authoritative for routing decisions and provider attempts.'] };
  }
}

function normalizeRequest(row: typeof requests.$inferSelect, provenance: DataProvenance): RequestIndexItem {
  return {
    requestId: row.id, correlationId: row.correlationId, observedAt: row.timestamp, clientId: row.clientId,
    path: row.path, requestType: row.requestType, requestedModel: row.requestedModel, status: row.status,
    statusCode: row.statusCode, durationMs: row.latencyMs, streaming: row.streaming, error: row.error,
    tokensInput: row.observedTokensInput, tokensOutput: row.observedTokensOutput, cost: row.observedCost, provenance,
  };
}
function nullableNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
