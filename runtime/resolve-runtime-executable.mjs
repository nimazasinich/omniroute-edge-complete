import path from 'node:path';

export function resolveRuntimeExecutable({ platform = process.platform, npmPrefix = process.env.NPM_CONFIG_PREFIX } = {}) {
  const executable = platform === 'win32' ? 'omniroute.cmd' : 'omniroute';
  const prefix = npmPrefix?.trim();
  if (!prefix) return executable;
  return platform === 'win32'
    ? path.join(prefix, executable)
    : path.join(prefix, 'bin', executable);
}

export function buildRuntimeEnvironment({ parentEnv, dataDir, storageKey, apiKey, dashboardPort, apiPort }) {
  const runtimeEnv = { ...parentEnv };
  delete runtimeEnv.PORT;
  return {
    ...runtimeEnv,
    DATA_DIR: dataDir,
    STORAGE_ENCRYPTION_KEY: storageKey,
    OMNIROUTE_API_KEY: apiKey,
    REQUIRE_API_KEY: 'true',
    OMNIROUTE_SERVER_HOST: '127.0.0.1',
    API_HOST: '127.0.0.1',
    DASHBOARD_PORT: String(dashboardPort),
    API_PORT: String(apiPort),
  };
}
