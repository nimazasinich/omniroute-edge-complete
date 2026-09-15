import type { ComboDraft, ComboPatch, ComboTestInput } from '../../domain/platform';
import { RequestValidationError } from './catalogValidation';

export function parseComboDraft(raw: unknown): ComboDraft {
  const body = record(raw, 'body');
  const name = requiredString(body.name, 'name', 1, 128);
  const strategy = requiredString(body.strategy, 'strategy', 1, 64);
  const targetRows = array(body.targets, 'targets', 1, 100);
  const targets = targetRows.map((target, index) => {
    const row = record(target, `targets[${index}]`);
    const normalized = {
      providerId: optionalString(row.providerId, `targets[${index}].providerId`, 128),
      connectionId: optionalString(row.connectionId, `targets[${index}].connectionId`, 256),
      modelId: optionalString(row.modelId, `targets[${index}].modelId`, 512),
      comboId: optionalString(row.comboId, `targets[${index}].comboId`, 256),
      weight: optionalNumber(row.weight, `targets[${index}].weight`, 0, 1000000),
      priority: optionalNumber(row.priority, `targets[${index}].priority`, 0, 1000000),
      fallbackTier: optionalNumber(row.fallbackTier, `targets[${index}].fallbackTier`, 0, 1000000),
    };
    if (!normalized.modelId && !normalized.comboId) {
      throw new RequestValidationError(`targets[${index}] must identify a modelId or comboId`);
    }
    if (normalized.modelId && normalized.comboId) {
      throw new RequestValidationError(`targets[${index}] cannot identify both modelId and comboId`);
    }
    return normalized;
  });
  return {
    name,
    strategy,
    enabled: optionalBoolean(body.enabled, 'enabled'),
    targets,
    auto: body.auto === undefined ? undefined : parseAuto(body.auto),
  };
}

export function parseComboPatch(raw: unknown): ComboPatch {
  const body = record(raw, 'body');
  const expectedRevision = requiredString(body.expectedRevision, 'expectedRevision', 1, 256);
  const patch = record(body.patch, 'patch');
  if (Object.keys(patch).length === 0) throw new RequestValidationError('patch must not be empty');
  const allowed = new Set(['name', 'strategy', 'enabled', 'targets', 'auto']);
  const unknown = Object.keys(patch).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new RequestValidationError('patch contains unsupported fields', { fields: unknown });
  const parsed: ComboPatch['patch'] = {};
  if ('name' in patch) parsed.name = requiredString(patch.name, 'patch.name', 1, 128);
  if ('strategy' in patch) parsed.strategy = requiredString(patch.strategy, 'patch.strategy', 1, 64);
  if ('enabled' in patch) parsed.enabled = optionalBoolean(patch.enabled, 'patch.enabled');
  if ('targets' in patch) parsed.targets = parseComboDraft({ name: 'validation', strategy: 'validation', targets: patch.targets }).targets;
  if ('auto' in patch) parsed.auto = parseAuto(patch.auto);
  return { expectedRevision, patch: parsed };
}

export function parseComboTestInput(raw: unknown): ComboTestInput {
  const body = record(raw, 'body');
  return {
    model: optionalString(body.model, 'model', 512),
    input: requiredString(body.input, 'input', 1, 100000),
  };
}

function parseAuto(raw: unknown): NonNullable<ComboDraft['auto']> {
  const value = record(raw, 'auto');
  const candidatePool = value.candidatePool === undefined
    ? undefined
    : array(value.candidatePool, 'auto.candidatePool', 0, 500).map((item, index) => requiredString(item, `auto.candidatePool[${index}]`, 1, 512));
  let weights: Record<string, number> | undefined;
  if (value.weights !== undefined) {
    const weightRecord = record(value.weights, 'auto.weights');
    weights = Object.fromEntries(Object.entries(weightRecord).map(([key, item]) => [key, requiredNumber(item, `auto.weights.${key}`, 0, 1000000)]));
  }
  return {
    variant: optionalString(value.variant, 'auto.variant', 128),
    routerStrategy: optionalString(value.routerStrategy, 'auto.routerStrategy', 128),
    weights,
    candidatePool,
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new RequestValidationError(`${label} must contain between ${min} and ${max} items`);
  }
  return value;
}

function requiredString(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new RequestValidationError(`${label} must contain between ${min} and ${max} characters`);
  }
  return value.trim();
}

function optionalString(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, label, 1, max);
}

function requiredNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RequestValidationError(`${label} must be a number between ${min} and ${max}`);
  }
  return value;
}

function optionalNumber(value: unknown, label: string, min: number, max: number): number | undefined {
  return value === undefined || value === null ? undefined : requiredNumber(value, label, min, max);
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new RequestValidationError(`${label} must be a boolean`);
  return value;
}
