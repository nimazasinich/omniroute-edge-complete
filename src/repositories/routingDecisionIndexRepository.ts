import { desc, eq } from 'drizzle-orm';
import type { DataProvenance, RoutingOutcome } from '../domain/platform';
import { routingDecisionIndex } from '../server/db/schema';
import type { AppDb } from '../server/db/types';

export class RoutingDecisionIndexRepository {
  constructor(private readonly db: AppDb, private readonly environmentId: string, private readonly now: () => number = Date.now) {}

  async ingest(outcomes: RoutingOutcome[]): Promise<{ accepted: number; skipped: number }> {
    let accepted = 0;
    let skipped = 0;
    for (const outcome of outcomes) {
      if (outcome.provenance.source !== 'omniroute' || !outcome.provenance.authoritative) {
        skipped += 1;
        continue;
      }
      await this.db.insert(routingDecisionIndex).values({
        requestId: outcome.requestId, correlationId: outcome.correlationId, outcomeObservedAt: outcome.observedAt,
        requestedModel: outcome.requestedModel, providerId: outcome.selected.providerId,
        connectionId: outcome.selected.connectionId, modelId: outcome.selected.modelId, comboId: outcome.selected.comboId,
        comboStepId: outcome.selected.comboStepId, comboExecutionKey: outcome.selected.comboExecutionKey,
        statusCode: outcome.statusCode, durationMs: outcome.durationMs, source: 'omniroute-call-log', ingestedAt: this.now(),
      }).onConflictDoUpdate({ target: routingDecisionIndex.requestId, set: {
        correlationId: outcome.correlationId, outcomeObservedAt: outcome.observedAt, requestedModel: outcome.requestedModel,
        providerId: outcome.selected.providerId, connectionId: outcome.selected.connectionId, modelId: outcome.selected.modelId,
        comboId: outcome.selected.comboId, comboStepId: outcome.selected.comboStepId,
        comboExecutionKey: outcome.selected.comboExecutionKey, statusCode: outcome.statusCode,
        durationMs: outcome.durationMs, source: 'omniroute-call-log', ingestedAt: this.now(),
      } });
      accepted += 1;
    }
    return { accepted, skipped };
  }

  async list(limit: number) {
    const rows = await this.db.select().from(routingDecisionIndex).orderBy(desc(routingDecisionIndex.outcomeObservedAt)).limit(limit);
    const provenance = this.provenance();
    return { items: rows.map((row) => this.normalize(row)), provenance };
  }

  async getOutcome(requestId: string) {
    const rows = await this.db.select().from(routingDecisionIndex).where(eq(routingDecisionIndex.requestId, requestId)).limit(1);
    return rows[0] ? this.normalize(rows[0]) : null;
  }

  private provenance(): DataProvenance {
    return { source: 'd1', authoritative: false, observedAt: this.now(), environmentId: this.environmentId,
      warnings: ['Durable copy of OmniRoute persisted call-log outcomes; consult item provenance semantics before operational use.'] };
  }

  private normalize(row: typeof routingDecisionIndex.$inferSelect): RoutingOutcome {
    return {
      requestId: row.requestId, correlationId: row.correlationId, observedAt: row.outcomeObservedAt,
      requestedModel: row.requestedModel,
      selected: { providerId: row.providerId, connectionId: row.connectionId, modelId: row.modelId, comboId: row.comboId,
        comboStepId: row.comboStepId, comboExecutionKey: row.comboExecutionKey },
      statusCode: row.statusCode, durationMs: row.durationMs, strategy: null, reason: null,
      score: { supported: false, reason: 'not-exposed' }, fallback: { supported: false, reason: 'not-exposed', attempts: [] },
      provenance: { source: 'omniroute', authoritative: true,
        observedAt: row.outcomeObservedAt ?? row.ingestedAt, environmentId: this.environmentId,
        warnings: ['Persisted OmniRoute call-log outcome served from the D1 read model.'] },
    };
  }
}
