import { eq } from 'drizzle-orm';
import { models, providers } from '../../server/db/schema';
import type { AppDb } from '../../server/db/types';
import type { CatalogResult, DataProvenance, ModelDefinition, ProviderConnection } from '../../domain/platform';

export interface SnapshotCatalogRepository {
  listProviderConnections(): Promise<CatalogResult<ProviderConnection>>;
  listModels(): Promise<CatalogResult<ModelDefinition>>;
}

export class SqliteSnapshotCatalogRepository implements SnapshotCatalogRepository {
  constructor(
    private readonly db: AppDb,
    private readonly environmentId: string,
    private readonly now: () => number = Date.now,
  ) {}

  async listProviderConnections(): Promise<CatalogResult<ProviderConnection>> {
    const provenance = this.provenance('Provider inventory is a local snapshot; runtime health is unknown.');
    const rows = await this.db.query.providers.findMany();
    return {
      items: rows.map((row) => ({
        id: String(row.id),
        providerId: String(row.type),
        name: String(row.name),
        enabled: Boolean(row.enabled),
        authType: null,
        runtime: { health: 'unknown' },
        tags: [],
        provenance,
      })),
      provenance,
    };
  }

  async listModels(): Promise<CatalogResult<ModelDefinition>> {
    const provenance = this.provenance('Model inventory is a local snapshot, not live OmniRoute state.');
    const rows = await this.db.select({
      id: models.modelName,
      providerId: models.providerId,
      providerName: providers.name,
      enabled: models.enabled,
      capabilities: models.capabilities,
      contextWindow: models.contextWindow,
      inputCost: models.inputCost,
      outputCost: models.outputCost,
    }).from(models).leftJoin(providers, eq(models.providerId, providers.id));

    return {
      items: rows.map((row) => ({
        id: row.id,
        providerId: row.providerId,
        displayName: row.id,
        enabled: row.enabled,
        capabilities: normalizeCapabilities(row.capabilities),
        limits: row.contextWindow > 0 ? { contextWindow: row.contextWindow } : undefined,
        pricing: row.inputCost > 0 || row.outputCost > 0 ? {
          inputPerMillion: row.inputCost > 0 ? row.inputCost * 1000 : undefined,
          outputPerMillion: row.outputCost > 0 ? row.outputCost * 1000 : undefined,
          currency: 'USD',
        } : undefined,
        provenance,
      })),
      provenance,
    };
  }

  private provenance(warning: string): DataProvenance {
    return {
      source: 'local-snapshot',
      authoritative: false,
      observedAt: this.now(),
      environmentId: this.environmentId,
      warnings: [warning],
    };
  }
}

function normalizeCapabilities(raw: unknown): ModelDefinition['capabilities'] {
  if (!Array.isArray(raw)) return {};
  const values = new Set(raw.filter((value): value is string => typeof value === 'string'));
  return {
    chat: values.has('chat') || undefined,
    reasoning: values.has('reasoning') || undefined,
    tools: values.has('tools') || values.has('tool_use') || undefined,
    vision: values.has('vision') || undefined,
    audio: values.has('audio') || undefined,
    video: values.has('video') || undefined,
    embeddings: values.has('embeddings') || undefined,
  };
}
