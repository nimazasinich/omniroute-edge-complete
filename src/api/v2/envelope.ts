import type { ApiEnvelope, ApiErrorEnvelope, DataProvenance, PaginationMeta } from '../../domain/platform';

export function getRequestId(headers: Headers, generateId: () => string = () => crypto.randomUUID()): string {
  return headers.get('X-Request-ID')?.trim() || generateId();
}

export function okEnvelope<T>(
  data: T,
  input: {
    requestId: string;
    environmentId: string;
    provenance: DataProvenance[];
    observedAt?: number;
    pagination?: PaginationMeta;
  },
): ApiEnvelope<T> {
  const observedAt = input.observedAt ?? Date.now();
  const sources = [...new Set(input.provenance.map((item) => item.source))];
  const warnings = [...new Set(input.provenance.flatMap((item) => item.warnings ?? []))];
  return {
    apiVersion: 'v2',
    data,
    meta: {
      source: sources.join(',') || 'control-api',
      authoritative: input.provenance.length > 0 && input.provenance.every((item) => item.authoritative),
      requestId: input.requestId,
      observedAt,
      environmentId: input.environmentId,
      warnings: warnings.length > 0 ? warnings : undefined,
      pagination: input.pagination,
      provenance: input.provenance,
    },
  };
}

export function errorEnvelope(
  input: Omit<ApiErrorEnvelope['error'], 'requestId' | 'retryable'> & { retryable?: boolean },
  meta: { requestId: string; environmentId: string; observedAt?: number },
): ApiErrorEnvelope {
  return {
    apiVersion: 'v2',
    error: {
      retryable: false,
      ...input,
      requestId: meta.requestId,
    },
    meta: {
      requestId: meta.requestId,
      observedAt: meta.observedAt ?? Date.now(),
      environmentId: meta.environmentId,
    },
  };
}
