import type { OmniRouteManagementAdapter } from '../integrations/omniroute/managementAdapter';
import { HttpOmniRouteManagementAdapter } from '../integrations/omniroute/managementAdapter';
import type { SnapshotCatalogRepository } from '../integrations/snapshot/catalogRepository';
import { SqliteSnapshotCatalogRepository } from '../integrations/snapshot/catalogRepository';
import type { AppBindings } from '../server/app';
import type { CatalogPage, CatalogQuery, ModelDefinition, ProviderConnection } from '../domain/platform';
import { getEnvironmentIdentity } from './capabilityService';

export class ProviderService {
  constructor(
    private readonly omniroute: OmniRouteManagementAdapter,
    private readonly snapshot: SnapshotCatalogRepository,
  ) {}

  async list(query: CatalogQuery): Promise<CatalogPage<ProviderConnection>> {
    const result = (await this.omniroute.listProviderConnections()) ?? await this.snapshot.listProviderConnections();
    return pageCatalog(result, query, (item) => item.name);
  }

  async get(id: string) {
    const result = (await this.omniroute.listProviderConnections()) ?? await this.snapshot.listProviderConnections();
    return { item: result.items.find((item) => item.id === id) ?? null, provenance: result.provenance };
  }
}

export class ModelService {
  constructor(
    private readonly omniroute: OmniRouteManagementAdapter,
    private readonly snapshot: SnapshotCatalogRepository,
  ) {}

  async list(query: CatalogQuery): Promise<CatalogPage<ModelDefinition>> {
    const result = (await this.omniroute.listModels()) ?? await this.snapshot.listModels();
    return pageCatalog(result, query, (item) => item.displayName ?? item.id);
  }

  async get(id: string) {
    const result = (await this.omniroute.listModels()) ?? await this.snapshot.listModels();
    return { item: result.items.find((item) => item.id === id) ?? null, provenance: result.provenance };
  }

  async compare(ids: string[]) {
    const result = (await this.omniroute.listModels()) ?? await this.snapshot.listModels();
    const byId = new Map(result.items.map((item) => [item.id, item]));
    return {
      items: ids.flatMap((id) => byId.get(id) ?? []),
      missingIds: ids.filter((id) => !byId.has(id)),
      provenance: result.provenance,
    };
  }
}

export function createCatalogServices(env: AppBindings) {
  const environment = getEnvironmentIdentity(env?.ENVIRONMENT);
  const snapshot = new SqliteSnapshotCatalogRepository(env.db, environment.id);
  const omniroute = new HttpOmniRouteManagementAdapter({
    origin: env?.OMNIROUTE_ORIGIN,
    originToken: env?.OMNIROUTE_ORIGIN_TOKEN,
    environmentId: environment.id,
  });
  return {
    environment,
    providers: new ProviderService(omniroute, snapshot),
    models: new ModelService(omniroute, snapshot),
  };
}

function pageCatalog<T extends { id: string; providerId: string | null; enabled?: boolean }>(
  result: { items: T[]; provenance: CatalogPage<T>['provenance'] },
  query: CatalogQuery,
  getName: (item: T) => string,
): CatalogPage<T> {
  const needle = query.search?.toLocaleLowerCase();
  const filtered = result.items.filter((item) => {
    if (query.providerId && item.providerId !== query.providerId) return false;
    if (query.enabled !== undefined && item.enabled !== query.enabled) return false;
    if (needle && !`${item.id} ${getName(item)} ${item.providerId ?? ''}`.toLocaleLowerCase().includes(needle)) return false;
    return true;
  });
  const direction = query.order === 'asc' ? 1 : -1;
  filtered.sort((left, right) => {
    const leftValue = query.sort === 'name' ? getName(left) : query.sort === 'providerId' ? left.providerId ?? '' : left.id;
    const rightValue = query.sort === 'name' ? getName(right) : query.sort === 'providerId' ? right.providerId ?? '' : right.id;
    return leftValue.localeCompare(rightValue) * direction;
  });
  return {
    items: filtered.slice(query.offset, query.offset + query.limit),
    provenance: result.provenance,
    pagination: { offset: query.offset, limit: query.limit, returned: Math.min(query.limit, Math.max(0, filtered.length - query.offset)), total: filtered.length },
  };
}
