import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const primaryPath = path.resolve(root, process.env.SQLITE_DB_PATH || 'sqlite.db');
const referencePath = path.resolve(root, process.env.OMNIROUTE_REFERENCE_DB_PATH || 'OmniRoute-provider-reference.sqlite.db');
const requiredTables = ['providers', 'models', 'api_keys', 'policies', 'requests', 'request_attempts', 'routing_decisions', 'security_events', 'audit_log'];
const requiredRequestColumns = ['path', 'correlation_id', 'status_code', 'error', 'streaming', 'observed_tokens_input', 'observed_tokens_output', 'observed_cost'];
const inventoryTables = ['providers', 'models', 'api_keys'];

function fail(message) {
  console.error(`DATA VERIFY FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function rows(db, sql) {
  return db.prepare(sql).all();
}

function scalar(db, sql, key = 'count') {
  const row = db.prepare(sql).get();
  return Number(row?.[key] ?? 0);
}

function inspect(label, filePath) {
  if (!fs.existsSync(filePath)) fail(`${label} database not found: ${filePath}`);
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    const integrityValue = String(integrity?.integrity_check ?? '').toLowerCase();
    if (integrityValue !== 'ok') fail(`${label} integrity_check returned ${integrityValue || 'unknown'}`);

    const fkViolations = rows(db, 'PRAGMA foreign_key_check');
    if (fkViolations.length !== 0) fail(`${label} has ${fkViolations.length} foreign-key violation(s)`);

    const tableSet = new Set(rows(db, "SELECT name FROM sqlite_master WHERE type='table'").map((row) => String(row.name)));
    for (const table of requiredTables) {
      if (!tableSet.has(table)) fail(`${label} is missing table ${table}`);
    }

    const counts = {};
    const ids = {};
    for (const table of requiredTables) {
      counts[table] = scalar(db, `SELECT COUNT(*) AS count FROM "${table}"`);
      if (inventoryTables.includes(table)) {
        ids[table] = rows(db, `SELECT id FROM "${table}" ORDER BY id`).map((row) => String(row.id));
      }
    }

    const requestColumns = new Set(rows(db, 'PRAGMA table_info(requests)').map((row) => String(row.name)));
    for (const column of requiredRequestColumns) {
      if (!requestColumns.has(column)) fail(`${label} requests table is missing ${column}`);
    }

    const orphanModels = scalar(db, `
      SELECT COUNT(*) AS count
      FROM models m
      LEFT JOIN providers p ON p.id = m.provider_id
      WHERE p.id IS NULL
    `);
    if (orphanModels !== 0) fail(`${label} contains ${orphanModels} orphan model rows`);

    const credentialSummary = {
      providerCredentialsConfigured: scalar(db, "SELECT COUNT(*) AS count FROM providers WHERE api_key_encrypted IS NOT NULL AND TRIM(api_key_encrypted) <> ''"),
      gatewayApiKeys: scalar(db, "SELECT COUNT(*) AS count FROM api_keys WHERE role = 'gateway'"),
      adminApiKeys: scalar(db, "SELECT COUNT(*) AS count FROM api_keys WHERE role = 'admin'"),
    };

    const providersWithoutModels = rows(db, `
      SELECT p.id, p.name
      FROM providers p
      LEFT JOIN models m ON m.provider_id = p.id
      GROUP BY p.id, p.name
      HAVING COUNT(m.id) = 0
      ORDER BY p.name, p.id
    `).map((row) => ({ id: String(row.id), name: String(row.name ?? row.id) }));

    return { db, counts, ids, credentialSummary, providersWithoutModels };
  } catch (error) {
    db.close();
    throw error;
  }
}

let primary;
let reference;
try {
  primary = inspect('primary', primaryPath);
  reference = inspect('reference', referencePath);

  for (const table of inventoryTables) {
    if (primary.counts[table] !== reference.counts[table]) {
      fail(`${table} count differs: primary=${primary.counts[table]} reference=${reference.counts[table]}`);
    }
    if (JSON.stringify(primary.ids[table]) !== JSON.stringify(reference.ids[table])) {
      fail(`${table} IDs differ between the two databases`);
    }
  }

  if (JSON.stringify(primary.credentialSummary) !== JSON.stringify(reference.credentialSummary)) {
    fail('provider/API-key credential metadata counts differ between the two databases');
  }

  if (primary.counts.providers === 0 || primary.counts.models === 0) {
    fail('provider/model inventory is empty');
  }

  console.log('DATA VERIFY PASS');
  console.log(`- providers: ${primary.counts.providers}`);
  console.log(`- models: ${primary.counts.models}`);
  console.log(`- api keys: ${primary.counts.api_keys}`);
  console.log(`- provider credentials configured: ${primary.credentialSummary.providerCredentialsConfigured}/${primary.counts.providers}`);
  console.log(`- gateway API-key metadata: ${primary.credentialSummary.gatewayApiKeys}`);
  console.log(`- admin API-key metadata: ${primary.credentialSummary.adminApiKeys}`);
  console.log(`- observed requests: ${primary.counts.requests}`);
  console.log(`- security events: ${primary.counts.security_events}`);
  console.log('- both databases have matching provider/model/key inventory IDs');
  console.log('- both databases pass integrity + foreign-key checks and contain the upgraded request telemetry schema');
  if (primary.providersWithoutModels.length) {
    console.log(`- source inventory note: ${primary.providersWithoutModels.length} provider connection(s) have no model rows; no models were fabricated`);
  }
} finally {
  primary?.db?.close();
  reference?.db?.close();
}
