import { describe, expect, it } from 'vitest';
import { buildFieldDiff } from '../../services/comboRevision';

describe('Combo revision diff', () => {
  it('produces deterministic field-level before/after changes without mutating either value', () => {
    const before = { name: 'old', targets: [{ modelId: 'model-a', weight: 1 }] };
    const after = { name: 'new', targets: [{ modelId: 'model-a', weight: 2 }, { modelId: 'model-b' }] };

    expect(buildFieldDiff(before, after)).toEqual([
      { path: 'name', before: 'old', after: 'new' },
      { path: 'targets[0].weight', before: 1, after: 2 },
      { path: 'targets[1]', before: undefined, after: { modelId: 'model-b' } },
    ]);
    expect(before).toEqual({ name: 'old', targets: [{ modelId: 'model-a', weight: 1 }] });
  });
});
