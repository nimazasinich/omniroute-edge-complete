import type { FieldDiff } from '../domain/platform';

export function buildFieldDiff(before: unknown, after: unknown): FieldDiff[] {
  const changes: FieldDiff[] = [];
  compareValues(before, after, '', changes);
  return changes;
}

function compareValues(before: unknown, after: unknown, path: string, changes: FieldDiff[]) {
  if (Object.is(before, after)) return;
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) compareValues(before[key], after[key], path ? `${path}.${key}` : key, changes);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      compareValues(before[index], after[index], `${path}[${index}]`, changes);
    }
    return;
  }
  changes.push({ path: path || '$', before, after });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
