import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'PACKAGE-MANIFEST.json');
const skipDirs = new Set(['.git', 'node_modules', 'dist', '.wrangler']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (full !== output) out.push(full);
  }
  return out;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

const files = walk(root).sort().map((file) => ({
  path: relative(root, file).replaceAll('\\', '/'),
  bytes: statSync(file).size,
  sha256: sha256(file),
}));
const payload = {
  format: 1,
  artifact: 'OmniRoute Edge PC Complete - secondary pages + synchronized local data',
  generatedAt: new Date().toISOString(),
  fileCount: files.length,
  files,
};
writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`manifest: ${files.length} files -> PACKAGE-MANIFEST.json`);
