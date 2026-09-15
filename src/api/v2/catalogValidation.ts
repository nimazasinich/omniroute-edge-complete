import type { CatalogQuery } from '../../domain/platform';

export class RequestValidationError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

export function parseCatalogQuery(url: URL): CatalogQuery {
  const limit = parseInteger(url.searchParams.get('limit'), 'limit', 50, 1, 200);
  const offset = parseInteger(url.searchParams.get('offset'), 'offset', 0, 0, 100000);
  const sortRaw = url.searchParams.get('sort') ?? 'id';
  if (!['id', 'name', 'providerId'].includes(sortRaw)) {
    throw new RequestValidationError('sort must be id, name, or providerId');
  }
  const orderRaw = url.searchParams.get('order') ?? 'asc';
  if (orderRaw !== 'asc' && orderRaw !== 'desc') {
    throw new RequestValidationError('order must be asc or desc');
  }
  const enabledRaw = url.searchParams.get('enabled');
  if (enabledRaw !== null && enabledRaw !== 'true' && enabledRaw !== 'false') {
    throw new RequestValidationError('enabled must be true or false');
  }
  return {
    search: cleanOptional(url.searchParams.get('search')),
    providerId: cleanOptional(url.searchParams.get('providerId')),
    enabled: enabledRaw === null ? undefined : enabledRaw === 'true',
    sort: sortRaw as CatalogQuery['sort'],
    order: orderRaw,
    offset,
    limit,
  };
}

export function parseComparisonIds(url: URL): string[] {
  const ids = [...new Set((url.searchParams.get('ids') ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
  if (ids.length < 2 || ids.length > 10) {
    throw new RequestValidationError('ids must contain between 2 and 10 unique model IDs');
  }
  return ids;
}

export function parseResourceId(raw: string, label: string): string {
  const value = raw.trim();
  if (!value || value.length > 512) throw new RequestValidationError(`${label} is invalid`);
  return value;
}

function parseInteger(raw: string | null, label: string, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new RequestValidationError(`${label} must be an integer`);
  const value = Number(raw);
  if (value < min || value > max) throw new RequestValidationError(`${label} must be between ${min} and ${max}`);
  return value;
}

function cleanOptional(raw: string | null): string | undefined {
  const value = raw?.trim();
  return value || undefined;
}
