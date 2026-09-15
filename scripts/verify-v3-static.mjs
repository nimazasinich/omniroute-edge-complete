import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const errors = [];
const notes = [];
const skipDirs = new Set(['.git', 'node_modules', 'dist', '.wrangler', '_qa']);
const textExts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.toml', '.md', '.html', '.css', '.sql', '.txt', '.example']);
const allowLocalDataBundle = process.env.ALLOW_LOCAL_DATA_BUNDLE === '1';
const approvedLocalDataFiles = new Set(['sqlite.db', 'OmniRoute-provider-reference.sqlite.db']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const rel = (p) => relative(root, p).replaceAll('\\', '/');

for (const file of files) {
  const path = rel(file);
  const base = path.split('/').at(-1);
  if (!allowLocalDataBundle && base === '.env') errors.push(`forbidden runtime artifact: ${path}`);
  if (/\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/.test(base)) {
    const approvedPcDatabase = allowLocalDataBundle && approvedLocalDataFiles.has(path);
    if (!approvedPcDatabase) errors.push(`forbidden runtime artifact: ${path}`);
  }
  if (path === 'data/providers-and-keys.json' || path === 'scratch_omniroute_raw.json') {
    if (!allowLocalDataBundle) errors.push(`forbidden credential/runtime dump: ${path}`);
  }
}

for (const forbiddenDir of ['node_modules', 'dist', '.wrangler']) {
  if (!allowLocalDataBundle && existsSync(join(root, forbiddenDir))) errors.push(`forbidden packaged directory exists: ${forbiddenDir}/`);
}

const secretPatterns = [
  [/cfut_[A-Za-z0-9_-]{20,}/g, 'Cloudflare token'],
  [/ghp_[A-Za-z0-9]{20,}/g, 'GitHub PAT'],
  [/vck_[A-Za-z0-9_-]{20,}/g, 'Vercel token'],
  [/hf_[A-Za-z0-9]{20,}/g, 'Hugging Face token'],
  [/sk-[A-Za-z0-9_-]{20,}/g, 'API secret'],
];

for (const file of files) {
  const path = rel(file);
  const ext = extname(file);
  if (!textExts.has(ext) && !file.endsWith('.env.example') && !file.endsWith('wrangler.toml')) continue;
  const text = readFileSync(file, 'utf8');
  for (const [regex, label] of secretPatterns) {
    regex.lastIndex = 0;
    if (regex.test(text) && !(allowLocalDataBundle && (path === 'data/providers-and-keys.json' || path === 'scratch_omniroute_raw.json'))) {
      errors.push(`${label} pattern found in ${path}`);
    }
  }
  if ((path.startsWith('src/') || path === 'server.ts') && text.includes('admin_secret')) {
    errors.push(`default admin secret marker found in production source: ${path}`);
  }
}

const codeFiles = files.filter((p) => /\.(?:ts|tsx|js|mjs)$/.test(p) && (rel(p).startsWith('src/') || rel(p) === 'server.ts'));
const importRegex = /(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"\n]+)\1/g;
const candidates = (base) => [
  base,
  `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`,
  join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js'),
];
for (const file of codeFiles) {
  const text = readFileSync(file, 'utf8');
  importRegex.lastIndex = 0;
  for (const match of text.matchAll(importRegex)) {
    const spec = match[2];
    const base = resolve(file, '..', spec);
    if (!candidates(base).some(existsSync)) errors.push(`unresolved local import ${spec} in ${rel(file)}`);
  }
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const lockRoot = lock.packages?.[''] ?? {};
for (const key of ['dependencies', 'devDependencies']) {
  const a = pkg[key] ?? {};
  const b = lockRoot[key] ?? {};
  if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`package.json and package-lock root ${key} differ`);
}
if (pkg.version !== lock.version || pkg.version !== lockRoot.version) {
  errors.push(`package version mismatch: package=${pkg.version} lock=${lock.version} lockRoot=${lockRoot.version}`);
}

for (const required of [
  'docs/reference/target-dashboard.png',
  'src/worker.ts',
  'src/edge/gatewayCore.ts',
  'src/edge/d1Telemetry.ts',
  'src/components/DashboardView.tsx',
]) {
  if (!existsSync(join(root, required))) errors.push(`missing required V3 file: ${required}`);
}

const worker = readFileSync(join(root, 'src/worker.ts'), 'utf8');
if (!worker.includes("url.pathname.startsWith('/v1/')") || !worker.includes("url.pathname === '/v1'")) errors.push('Worker is not the authoritative /v1 production path');
if (worker.includes('routeRequest(')) errors.push('Worker unexpectedly invokes local routing logic');

const deletedRuntimeModules = ['src/server/router.ts', 'src/server/health.ts', 'src/server/policy.ts', 'src/server/firewall.ts'];
for (const path of deletedRuntimeModules) {
  if (!allowLocalDataBundle && existsSync(join(root, path))) errors.push(`retired local routing/security module restored: ${path}`);
}

notes.push(`scanned ${files.length} files`);
notes.push(`checked ${codeFiles.length} active code files for local import integrity`);
if (allowLocalDataBundle) notes.push('PC data-bundle mode allowed only sqlite.db and OmniRoute-provider-reference.sqlite.db');

if (errors.length) {
  console.error(`STATIC SAFETY FAIL (${errors.length} errors)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('STATIC SAFETY PASS');
for (const note of notes) console.log(`- ${note}`);
