import path from 'node:path';

export function resolveRuntimeExecutable({ platform = process.platform, npmPrefix = process.env.NPM_CONFIG_PREFIX } = {}) {
  const executable = platform === 'win32' ? 'omniroute.cmd' : 'omniroute';
  const prefix = npmPrefix?.trim();
  if (!prefix) return executable;
  return platform === 'win32'
    ? path.join(prefix, executable)
    : path.join(prefix, 'bin', executable);
}
