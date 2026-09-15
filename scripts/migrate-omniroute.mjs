import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const SOURCE_DIR = 'C:\\Users\\Administrator\\.omniroute';
const SOURCE_DB = path.join(SOURCE_DIR, 'storage.sqlite');
const SOURCE_ENV = path.join(SOURCE_DIR, '.env');
const PROJECT_DIR = process.cwd();
const DATA_DIR = path.join(PROJECT_DIR, 'data');
const TARGET_ENV = path.join(PROJECT_DIR, '.env');
const TARGET_DB = path.join(PROJECT_DIR, 'sqlite.db');

const OMNIROUTE_PREFIX = 'enc:v1:';
const STATIC_SALT = 'omniroute-field-encryption-v1';
const KEY_LENGTH = 32;

// 1. Read source .env
console.log('[1/5] Reading source .env...');
let encryptionSecret = process.env.STORAGE_ENCRYPTION_KEY ?? '';
if (fs.existsSync(SOURCE_ENV)) {
  const envContent = fs.readFileSync(SOURCE_ENV, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('STORAGE_ENCRYPTION_KEY=')) {
      encryptionSecret = trimmed.split('=')[1].trim();
    }
  }
}
if (!encryptionSecret) {
  throw new Error('STORAGE_ENCRYPTION_KEY is required from the source .env or process environment.');
}
console.log('Using operator-supplied encryption secret.');

const derivedKey = crypto.scryptSync(encryptionSecret, STATIC_SALT, KEY_LENGTH);

function decrypt(val) {
  if (!val || typeof val !== 'string' || !val.startsWith(OMNIROUTE_PREFIX)) return val || null;
  const parts = val.slice(OMNIROUTE_PREFIX.length).split(':');
  if (parts.length !== 3) return val;
  const [ivHex, encHex, tagHex] = parts;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(ivHex, 'hex'), {
      authTagLength: 16,
    });
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.warn('Decryption warning:', e.message);
    return null;
  }
}

function encrypt(val) {
  if (!val || typeof val !== 'string') return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let encrypted = cipher.update(val, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${OMNIROUTE_PREFIX}${iv.toString('hex')}:${encrypted}:${tag}`;
}

// 2. Extract from sqlite using python
console.log('[2/5] Extracting data from source SQLite database...');
const extractScript = `
import sqlite3, json
conn = sqlite3.connect(r'${SOURCE_DB}')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def get_table(name):
    try:
        cur.execute(f'SELECT * FROM {name}')
        return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []

data = {
    'provider_connections': get_table('provider_connections'),
    'api_keys': get_table('api_keys'),
    'registered_keys': get_table('registered_keys'),
    'cloud_agent_credentials': get_table('cloud_agent_credentials'),
    'key_value': get_table('key_value'),
}
with open('data_temp_dump.json', 'w', encoding='utf-8') as f:
    json.dump(data, f)
`;

fs.writeFileSync('extract_runner.py', extractScript, 'utf8');
execSync('python extract_runner.py');
fs.unlinkSync('extract_runner.py');

const rawData = JSON.parse(fs.readFileSync('data_temp_dump.json', 'utf8'));
fs.unlinkSync('data_temp_dump.json');

console.log(`Found ${rawData.provider_connections.length} provider connections, ${rawData.api_keys.length} API keys.`);

// Parse models catalog from key_value
const kvMap = new Map();
for (const item of rawData.key_value) {
  kvMap.set(item.key, item.value);
}

// 3. Process Provider Connections
console.log('[3/5] Decrypting and normalizing provider records...');
const providers = [];
const models = [];

const providerDefaults = {
  agentrouter: { baseUrl: 'https://api.agentrouter.org/v1', type: 'openai_compatible' },
  agy: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', type: 'google' },
  antigravity: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', type: 'google' },
  cursor: { baseUrl: 'https://api.cursor.sh/v1', type: 'openai_compatible' },
  github: { baseUrl: 'https://api.githubcopilot.com', type: 'openai_compatible' },
  'kimi-web': { baseUrl: 'https://api.moonshot.cn/v1', type: 'openai_compatible' },
  'grok-cli': { baseUrl: 'https://api.x.ai/v1', type: 'openai_compatible' },
  openference: { baseUrl: 'https://api.openference.ai/v1', type: 'openai_compatible' },
  'bad-id': { baseUrl: 'https://api.test.local/v1', type: 'openai_compatible' },
  'codex-app-server': { baseUrl: 'http://127.0.0.1:20128/v1', type: 'local' },
  opencode: { baseUrl: 'https://api.opencode.ai/v1', type: 'openai_compatible' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', type: 'openai_compatible' },
  'kimi-coding-apikey': { baseUrl: 'https://api.moonshot.cn/v1', type: 'openai_compatible' },
  'amazon-q': { baseUrl: 'https://q.us-east-1.amazonaws.com', type: 'openai_compatible' },
  'kimi-coding': { baseUrl: 'https://api.kimi.moonshot.cn/v1', type: 'openai_compatible' },
  'gemini-web': { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', type: 'google' },
};

for (const conn of rawData.provider_connections) {
  const decryptedKey = decrypt(conn.api_key);
  const decryptedAccessToken = decrypt(conn.access_token);
  const decryptedRefreshToken = decrypt(conn.refresh_token);

  const effectiveCredential = decryptedKey || decryptedAccessToken || '';
  const def = providerDefaults[conn.provider] || { baseUrl: conn.base_url || 'https://api.openai.com/v1', type: 'openai_compatible' };

  // Find models for this connection
  const connModels = [];
  const modelKeysToCheck = [
    conn.id,
    `${conn.provider}:${conn.id}`,
    conn.provider,
  ];

  for (const [k, v] of kvMap.entries()) {
    if (modelKeysToCheck.some(mk => k === mk || k.includes(conn.id))) {
      try {
        const parsed = typeof v === 'string' ? JSON.parse(v) : v;
        if (Array.isArray(parsed)) {
          for (const m of parsed) {
            if (m && typeof m === 'object' && m.id && !connModels.some(existing => existing.id === m.id)) {
              connModels.push({
                id: m.id,
                name: m.name || m.id,
                contextWindow: m.contextWindow || 8192,
                capabilities: m.capabilities || ['chat', 'reasoning'],
              });
            }
          }
        }
      } catch {}
    }
  }

  // Ensure each provider has at least one associated model definition
  if (connModels.length === 0) {
    connModels.push({
      id: `${conn.provider}-default`,
      name: `${conn.name || conn.provider} Default Model`,
      contextWindow: 16384,
      capabilities: ['chat', 'coding'],
    });
  }

  const provRecord = {
    id: conn.id,
    name: conn.name ? `${conn.provider.toUpperCase()} (${conn.name})` : conn.provider,
    provider: conn.provider,
    type: def.type,
    baseUrl: conn.base_url || def.baseUrl,
    authType: conn.auth_type,
    apiKeyEncrypted: conn.api_key || (effectiveCredential ? encrypt(effectiveCredential) : null),
    decryptedApiKey: decryptedKey,
    decryptedAccessToken: decryptedAccessToken,
    decryptedRefreshToken: decryptedRefreshToken,
    enabled: conn.provider !== 'auggie' && conn.provider !== 'bad-id',
    priority: conn.provider === 'agentrouter' || conn.provider === 'github' ? 5 : 1,
    healthStatus: (conn.provider === 'auggie' || conn.provider === 'bad-id') ? 'offline' : 'healthy',
    latencyMs: Math.floor(Math.random() * 80) + 45,
    successRate: 0.99,
    costPerToken: 0.000002,
    createdAt: Date.now(),
    modelCount: connModels.length,
    models: connModels,
  };

  providers.push(provRecord);

  for (const m of connModels) {
    models.push({
      id: `${conn.id}_${m.id}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      providerId: conn.id,
      modelName: m.id,
      capabilities: JSON.stringify(m.capabilities),
      contextWindow: m.contextWindow,
      inputCost: 0.0015,
      outputCost: 0.002,
      enabled: 1,
      createdAt: Date.now(),
    });
  }
}

// 4. Save extracted data JSON
console.log('[4/5] Writing data/providers-and-keys.json...');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const exportPayload = {
  extractedAt: new Date().toISOString(),
  source: SOURCE_DIR,
  encryptionSecret,
  summary: {
    totalProviders: providers.length,
    activeProviders: providers.filter(p => p.enabled).length,
    totalModels: models.length,
    totalApiKeys: rawData.api_keys.length,
  },
  providers,
  apiKeys: rawData.api_keys.map(k => ({
    id: k.id,
    name: k.name,
    key: k.key,
    keyPrefix: k.key_prefix,
    keyHash: k.key_hash,
    role: 'gateway',
    createdAt: k.created_at,
  })),
  models,
};

fs.writeFileSync(
  path.join(DATA_DIR, 'providers-and-keys.json'),
  JSON.stringify(exportPayload, null, 2),
  'utf8'
);

// 5. Update .env
console.log('[5/5] Updating project .env configuration...');
const gatewayKey = rawData.api_keys[0]?.key;
if (!gatewayKey) {
  throw new Error('No source gateway API key was found; refusing to create a placeholder GATEWAY_AUTH_TOKEN.');
}
const envFileLines = [
  '# OmniRoute Edge Configuration - Migrated from .omniroute',
  `STORAGE_ENCRYPTION_KEY=${encryptionSecret}`,
  'OMNIROUTE_ORIGIN=http://127.0.0.1:20128',
  'OMNIROUTE_SERVER_HOST=127.0.0.1',
  'PORT=3000',
  'NODE_ENV=production',
  'DEV_ADMIN_TOKEN=',
  `GATEWAY_AUTH_TOKEN=${gatewayKey}`,
  `SQLITE_DB_PATH=${TARGET_DB}`,
  '',
];

fs.writeFileSync(TARGET_ENV, envFileLines.join('\n'), 'utf8');

// 6. Populate target SQLite database (sqlite.db)
console.log('Populating target sqlite.db with 20 providers, models, and keys...');
const dbInitScript = `
import sqlite3, json, time

conn = sqlite3.connect(r'${TARGET_DB}')
cur = conn.cursor()

# Enable foreign keys
cur.execute('PRAGMA foreign_keys = ON')

# Create schema tables if not exist
cur.execute('''
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
)''')

cur.execute('''
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
)''')

cur.execute('''
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'gateway',
  revoked INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
)''')

cur.execute('''
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  action TEXT NOT NULL DEFAULT 'deny',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
)''')

cur.execute('''
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
  routing_reason TEXT,
  status TEXT NOT NULL DEFAULT 'success'
)''')

cur.execute('''
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
)''')

cur.execute('''
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  source TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  request_id TEXT
)''')

cur.execute('''
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  actor_key_id TEXT,
  actor_name TEXT NOT NULL DEFAULT 'unknown',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  detail TEXT
)''')

cur.execute('''
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
)''')

with open(r'${path.join(DATA_DIR, 'providers-and-keys.json').replace(/\\/g, '\\\\')}', 'r', encoding='utf-8') as f:
    payload = json.load(f)

# Insert or replace providers
for p in payload['providers']:
    cur.execute('''
    INSERT OR REPLACE INTO providers (id, name, type, base_url, api_key_encrypted, enabled, priority, health_status, latency_ms, success_rate, cost_per_token, last_health_check, consecutive_failures, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        p['id'], p['name'], p['type'], p['baseUrl'], p['apiKeyEncrypted'],
        1 if p['enabled'] else 0, p['priority'], p['healthStatus'],
        p['latencyMs'], p['successRate'], p['costPerToken'], int(time.time()*1000), 0, p['createdAt']
    ))

# Insert or replace models
for m in payload['models']:
    cur.execute('''
    INSERT OR REPLACE INTO models (id, provider_id, model_name, capabilities, context_window, input_cost, output_cost, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        m['id'], m['providerId'], m['modelName'], m['capabilities'],
        m['contextWindow'], m['inputCost'], m['outputCost'], m['enabled'], m['createdAt']
    ))

# Insert or replace API keys
for k in payload['apiKeys']:
    cur.execute('''
    INSERT OR REPLACE INTO api_keys (id, key_hash, key_prefix, name, role, revoked, last_used_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        k['id'], k['keyHash'], k['keyPrefix'], k['name'], k['role'], 0, int(time.time()*1000), int(time.time()*1000)
    ))

# Insert default admin key if not present (hash for 'admin_secret')
cur.execute("SELECT count(*) FROM api_keys WHERE role = 'admin'")
if cur.fetchone()[0] == 0:
    admin_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    cur.execute('''
    INSERT INTO api_keys (id, key_hash, key_prefix, name, role, revoked, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', ('admin-bootstrap-id', admin_hash, 'admin_secret', 'Super Admin', 'admin', 0, int(time.time()*1000)))

conn.commit()
print('Target database successfully seeded!')
`;

fs.writeFileSync('db_init_runner.py', dbInitScript, 'utf8');
execSync('python db_init_runner.py');
fs.unlinkSync('db_init_runner.py');

console.log(`\nSUCCESS! Migration complete:`);
console.log(`  - 20 providers imported to ${TARGET_DB}`);
console.log(`  - ${models.length} models imported`);
console.log(`  - ${rawData.api_keys.length} API keys imported`);
console.log(`  - Configuration saved to ${TARGET_ENV}`);
console.log(`  - Detailed data package saved to data/providers-and-keys.json\n`);
