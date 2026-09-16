import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import * as schema from './schema';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { AppDb } from './types';

let client: Client | null = null;
let nodeDb: AppDb | null = null;

function createConfiguredClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!authToken) throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is configured');
    return createClient({ url: tursoUrl, authToken });
  }

  const dbPath = process.env.SQLITE_DB_PATH ?? path.join(process.cwd(), 'sqlite.db');
  return createClient({ url: dbPath === ':memory:' ? ':memory:' : `file:${dbPath}` });
}

function ensureNodeDb(): { client: Client; db: AppDb } {
  if (!client || !nodeDb) {
    client = createConfiguredClient();
    nodeDb = drizzle(client, { schema });
  }
  return { client, db: nodeDb };
}

/** Lazily creates (once) and returns the Node/libsql drizzle instance. */
export function getNodeDb(): AppDb {
  return ensureNodeDb().db;
}

/** Returns the underlying libSQL client used by Node-only runtime adapters. */
export function getNodeClient(): Client {
  return ensureNodeDb().client;
}

/** Creates a brand-new, isolated (non-singleton) Node/libsql db + schema — for tests only.
 * Each call gets its own connection and its own set of tables, so tests never share state
 * with each other or with the process-wide getNodeDb() singleton. */
export async function createTestDb(): Promise<{ db: AppDb; client: Client }> {
  const testClient = createClient({ url: ':memory:' });
  const testDb = drizzle(testClient, { schema });
  await runMigrations(testClient, { seedAdminKey: false });
  return { db: testDb, client: testClient };
}

/** Creates tables (if missing) and bootstraps the first admin key. Node/local/Vercel only —
 * Cloudflare D1 uses `npm run cf:d1:migrate` (drizzle-kit generated migrations) instead. */
export async function initializeDb() {
  const configured = ensureNodeDb();
  console.log(process.env.TURSO_DATABASE_URL?.trim()
    ? 'Initializing Turso/libSQL database schema...'
    : 'Initializing local SQLite database schema...');
  await runMigrations(configured.client, { seedAdminKey: true });
}

async function runMigrations(execClient: Client, opts: { seedAdminKey: boolean }) {
  // Foreign keys are OFF by default in SQLite/libsql connections — without this,
  // request_attempts.request_id -> requests.id has no real enforcement, and the
  // CP04 ordering bug (attempts inserted before the parent request row exists)
  // would silently "work" locally while still being unsafe in general.
  // Must run before any INSERT for this connection.
  await execClient.execute('PRAGMA foreign_keys = ON');

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'openai_compatible',
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 1,
      health_status TEXT NOT NULL DEFAULT 'offline',
      latency_ms INTEGER,
      success_rate REAL NOT NULL DEFAULT 1,
      cost_per_token REAL NOT NULL DEFAULT 0,
      last_health_check INTEGER,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      model_name TEXT NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '[]',
      context_window INTEGER NOT NULL DEFAULT 8192,
      input_cost REAL NOT NULL DEFAULT 0,
      output_cost REAL NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'gateway',
      revoked INTEGER NOT NULL DEFAULT 0,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL
    )
  `);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS gateway_rate_limits (
      identity TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      action TEXT NOT NULL DEFAULT 'deny',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      client_id TEXT NOT NULL,
      request_type TEXT NOT NULL DEFAULT 'chat',
      requested_model TEXT,
      selected_model TEXT,
      provider_id TEXT,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      tokens_input INTEGER NOT NULL DEFAULT 0,
      tokens_output INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      observed_tokens_input INTEGER,
      observed_tokens_output INTEGER,
      observed_cost REAL,
      routing_reason TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      path TEXT,
      correlation_id TEXT,
      status_code INTEGER,
      error TEXT,
      streaming INTEGER NOT NULL DEFAULT 0
    )
  `);
  const requestColumns = await execClient.execute('PRAGMA table_info(requests)');
  const requestColumnNames = new Set(requestColumns.rows.map((row) => String(row.name)));
  const requestUpgrades: Array<[string, string]> = [
    ['path', 'ALTER TABLE requests ADD COLUMN path TEXT'],
    ['correlation_id', 'ALTER TABLE requests ADD COLUMN correlation_id TEXT'],
    ['status_code', 'ALTER TABLE requests ADD COLUMN status_code INTEGER'],
    ['error', 'ALTER TABLE requests ADD COLUMN error TEXT'],
    ['streaming', 'ALTER TABLE requests ADD COLUMN streaming INTEGER NOT NULL DEFAULT 0'],
    ['observed_tokens_input', 'ALTER TABLE requests ADD COLUMN observed_tokens_input INTEGER'],
    ['observed_tokens_output', 'ALTER TABLE requests ADD COLUMN observed_tokens_output INTEGER'],
    ['observed_cost', 'ALTER TABLE requests ADD COLUMN observed_cost REAL'],
  ];
  for (const [column, sql] of requestUpgrades) {
    if (!requestColumnNames.has(column)) await execClient.execute(sql);
  }

  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp)`);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_requests_client ON requests(client_id)`);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_requests_correlation_id ON requests(correlation_id)`);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS routing_decisions (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      timestamp INTEGER NOT NULL,
      request_type TEXT NOT NULL,
      selected_provider_id TEXT,
      selected_model_id TEXT,
      score REAL,
      reasons TEXT NOT NULL DEFAULT '[]',
      candidates TEXT NOT NULL DEFAULT '[]'
    )
  `);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      source TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      request_id TEXT
    )
  `);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp)`);

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      actor_key_id TEXT,
      actor_name TEXT NOT NULL DEFAULT 'unknown',
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      detail TEXT
    )
  `);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)`);

  // CP04: failover attempt evidence
  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS request_attempts (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      attempt_number INTEGER NOT NULL,
      provider_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      result TEXT NOT NULL,
      failure_category TEXT,
      http_status INTEGER,
      error_detail TEXT
    )
  `);

  // Browser admin auth tables. These are separate from API-key auth.
  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT,
      display_name TEXT NOT NULL DEFAULT 'Administrator',
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      status TEXT NOT NULL DEFAULT 'active',
      oauth_provider TEXT,
      oauth_subject TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    )
  `);
  const authUserColumns = await execClient.execute('PRAGMA table_info(auth_users)');
  const authUserColumnNames = new Set(authUserColumns.rows.map((row) => String(row.name)));
  if (!authUserColumnNames.has('username')) await execClient.execute('ALTER TABLE auth_users ADD COLUMN username TEXT');
  await execClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username) WHERE username IS NOT NULL');

  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      user_agent TEXT
    )
  `);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)`);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at)`);
  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      id TEXT PRIMARY KEY,
      email_hash TEXT NOT NULL,
      attempted_at INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 0
    )
  `);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_time ON auth_login_attempts(email_hash, attempted_at)`);

  // V2 observation-plane routing outcome index. This stores only explicitly
  // ingested OmniRoute outcomes and is never used as routing authority.
  await execClient.execute(`
    CREATE TABLE IF NOT EXISTS routing_decision_index (
      request_id TEXT PRIMARY KEY,
      correlation_id TEXT,
      outcome_observed_at INTEGER,
      requested_model TEXT,
      provider_id TEXT,
      connection_id TEXT,
      model_id TEXT,
      combo_id TEXT,
      combo_step_id TEXT,
      combo_execution_key TEXT,
      status_code INTEGER,
      duration_ms INTEGER,
      source TEXT NOT NULL DEFAULT 'omniroute-call-log',
      ingested_at INTEGER NOT NULL
    )
  `);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_routing_decision_correlation ON routing_decision_index(correlation_id)`);
  await execClient.execute(`CREATE INDEX IF NOT EXISTS idx_routing_decision_observed_at ON routing_decision_index(outcome_observed_at)`);

  // Optional explicit local-dev admin key. Never synthesize a default credential.
  // If no DEV_ADMIN_TOKEN is supplied, use the /api/bootstrap flow with BOOTSTRAP_SECRET.
  if (!opts.seedAdminKey) return;
  const res = await execClient.execute("SELECT count(*) as count FROM api_keys WHERE role = 'admin'");
  if (Number(res.rows[0].count) === 0) {
    const configuredDevKey = process.env.DEV_ADMIN_TOKEN?.trim();
    if (!configuredDevKey) {
      console.log('No local admin API key exists. Configure DEV_ADMIN_TOKEN explicitly or use /api/bootstrap with BOOTSTRAP_SECRET.');
      return;
    }
    const keyHash = await bcrypt.hash(configuredDevKey, 10);
    await execClient.execute({
      sql: 'INSERT INTO api_keys (id, key_hash, key_prefix, name, role, revoked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [uuidv4(), keyHash, configuredDevKey.slice(0, 12), 'Local Dev Admin', 'admin', 0, Date.now()],
    });
    console.log('Configured DEV_ADMIN_TOKEN was registered as the local admin key.');
  }
}
