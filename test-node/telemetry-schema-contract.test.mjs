import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requiredColumns = ['path', 'correlation_id', 'status_code', 'error', 'streaming'];

test('gateway telemetry columns exist in schema and migration SQL', async () => {
  const schema = await readFile('src/server/db/schema.ts', 'utf8');
  const migrations = (await Promise.all([
    readFile('drizzle/0000_eminent_wraith.sql', 'utf8'),
    readFile('drizzle/0001_request_attempts.sql', 'utf8'),
    readFile('drizzle/0002_gateway_telemetry.sql', 'utf8'),
  ])).join('\n');
  for (const col of requiredColumns) {
    assert.ok(schema.includes(col.replace(/_([a-z])/g, (_, c) => c.toUpperCase())) || schema.includes(`\"${col}\"`), `schema missing ${col}`);
    assert.ok(migrations.includes(col), `migrations missing ${col}`);
  }
});
