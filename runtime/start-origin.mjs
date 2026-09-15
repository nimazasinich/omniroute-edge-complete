import http from 'node:http';
import { spawn } from 'node:child_process';
import { createOriginIngress } from './origin-ingress.mjs';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const publicPort = Number(process.env.PORT || 8080);
if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const dataDir = required('DATA_DIR');
const storageKey = required('STORAGE_ENCRYPTION_KEY');
if (storageKey.length < 32) throw new Error('STORAGE_ENCRYPTION_KEY must be at least 32 characters');
const apiKey = required('OMNIROUTE_API_KEY');
const originSharedSecret = required('ORIGIN_SHARED_SECRET');
const dashboardPort = 20129;
const apiPort = 20130;

const runtimeExecutable = process.platform === 'win32' ? 'omniroute.cmd' : 'omniroute';
const runtime = spawn(runtimeExecutable, [
  'serve', '--no-open', '--no-tray', '--no-recovery', '--port', String(dashboardPort),
], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    DATA_DIR: dataDir,
    STORAGE_ENCRYPTION_KEY: storageKey,
    OMNIROUTE_API_KEY: apiKey,
    REQUIRE_API_KEY: 'true',
    OMNIROUTE_SERVER_HOST: '127.0.0.1',
    API_HOST: '127.0.0.1',
    DASHBOARD_PORT: String(dashboardPort),
    API_PORT: String(apiPort),
  },
});

const ingress = createOriginIngress({
  runtimeOrigin: `http://127.0.0.1:${apiPort}`,
  healthOrigin: `http://127.0.0.1:${dashboardPort}`,
  originSharedSecret,
  runtimeApiKey: apiKey,
});
const server = http.createServer(async (req, res) => {
  const bodyAllowed = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(`http://origin.internal${req.url || '/'}`, {
    method: req.method,
    headers: req.headers,
    body: bodyAllowed ? req : undefined,
    duplex: bodyAllowed ? 'half' : undefined,
  });
  const response = await ingress(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) return res.end();
  for await (const chunk of response.body) res.write(chunk);
  res.end();
});

server.listen(publicPort, '0.0.0.0', () => {
  console.log(`OmniRoute origin ingress listening on 0.0.0.0:${publicPort}`);
});

function shutdown(signal) {
  server.close(() => process.exit(0));
  runtime.kill(signal);
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
runtime.on('exit', (code, signal) => {
  console.error(`OmniRoute runtime exited (code=${code ?? 'none'}, signal=${signal ?? 'none'})`);
  server.close(() => process.exit(code || 1));
});
runtime.on('error', (error) => {
  console.error(`Failed to start OmniRoute runtime: ${error.message}`);
  server.close(() => process.exit(1));
});
