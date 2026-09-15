import { describe, expect, it } from 'vitest';
import { seedApiKey, setupTest } from './testHarness';

describe('api key observability', () => {
  it('keeps masked key metadata behind admin authorization', async () => {
    const { db, call } = await setupTest();
    const adminToken = await seedApiKey(db, 'admin');

    const forbidden = await call('/api/admin/keys');
    expect(forbidden.status).toBe(403);

    const res = await call('/api/admin/keys', {}, { token: adminToken });
    expect(res.status).toBe(200);

    const rows = await res.json() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.role === 'gateway')).toBe(true);
    expect(rows.some((row) => row.role === 'admin')).toBe(true);
    for (const row of rows) {
      expect(String(row.maskedKey)).toMatch(/…$/);
      expect(row).not.toHaveProperty('keyHash');
      expect(row).not.toHaveProperty('rawKey');
      expect(row).not.toHaveProperty('rawSecret');
    }
  });
});
