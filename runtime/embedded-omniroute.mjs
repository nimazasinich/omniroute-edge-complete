import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { buildRuntimeEnvironment, resolveRuntimeExecutable } from './resolve-runtime-executable.mjs';

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required when OMNIROUTE_EMBEDDED=true`);
  return value;
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

export function startEmbeddedOmniRoute({ env = process.env, spawnImpl = spawn } = {}) {
  if (env.OMNIROUTE_EMBEDDED !== 'true') return null;

  const dataDir = env.DATA_DIR?.trim() || '/tmp/omniroute';
  const storageKey = required(env, 'STORAGE_ENCRYPTION_KEY');
  const apiKey = required(env, 'OMNIROUTE_API_KEY');
  if (storageKey.length < 32) throw new Error('STORAGE_ENCRYPTION_KEY must be at least 32 characters');

  const dashboardPort = parsePort(env.DASHBOARD_PORT, 20129);
  const apiPort = parsePort(env.API_PORT, 20130);
  const readyTimeoutMs = parsePort(env.OMNIROUTE_READY_TIMEOUT_MS, 180_000);
  mkdirSync(dataDir, { recursive: true });

  const runtimeEnv = buildRuntimeEnvironment({
    parentEnv: env,
    dataDir,
    storageKey,
    apiKey,
    dashboardPort,
    apiPort,
  });
  runtimeEnv.OMNIROUTE_READY_TIMEOUT_MS = String(readyTimeoutMs);

  const child = spawnImpl(resolveRuntimeExecutable(), [
    'serve',
    '--no-open',
    '--no-tray',
    '--port', String(dashboardPort),
    '--ready-timeout', String(readyTimeoutMs),
    '--max-restarts', '2',
    '--log',
  ], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: runtimeEnv,
  });

  child.on?.('error', (error) => {
    console.error(`Embedded OmniRoute failed to start: ${error.message}`);
  });
  child.on?.('exit', (code, signal) => {
    console.error(`Embedded OmniRoute exited (code=${code ?? 'none'}, signal=${signal ?? 'none'})`);
  });

  return {
    origin: `http://127.0.0.1:${apiPort}`,
    apiKey,
    child,
  };
}
