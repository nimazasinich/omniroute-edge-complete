export type BrowserAuthProvider = 'google' | 'github' | 'microsoft';

export interface BrowserUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  role: string;
  status: string;
  loginMethod: string;
  lastLoginAt: number | null;
}

export interface BrowserPermissions {
  role: string;
  permissions: string[];
}

export interface BrowserAuthStatus {
  authenticated: boolean;
  user: BrowserUser | null;
  bootstrapRequired: boolean;
  providers: Record<BrowserAuthProvider, boolean>;
  sessionExpiresAt: number | null;
}

export interface WorkspaceProbe {
  readiness: unknown;
  capabilities: unknown;
  omniRouteStatus: unknown;
}

const CSRF_COOKIE = 'dw_csrf';

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  for (const raw of document.cookie.split(';')) {
    const part = raw.trim();
    if (!part.startsWith(prefix)) continue;
    try { return decodeURIComponent(part.slice(prefix.length)); } catch { return part.slice(prefix.length); }
  }
  return '';
}

export function getCsrfToken(): string {
  return readCookie(CSRF_COOKIE);
}

async function parseJson(response: Response): Promise<any> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? body?.error ?? `Request failed (${response.status})`;
    const error = new Error(String(message));
    (error as Error & { status?: number; details?: unknown }).status = response.status;
    (error as Error & { status?: number; details?: unknown }).details = body;
    throw error;
  }
  return body;
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  return fetch(path, { ...init, headers, credentials: 'same-origin' });
}

export async function getAuthStatus(): Promise<BrowserAuthStatus> {
  return parseJson(await authFetch('/api/auth/status'));
}

export async function authProviders(): Promise<BrowserAuthStatus['providers']> {
  return (await getAuthStatus()).providers;
}

export async function checkSession(): Promise<{ user: BrowserUser; expiresAt: number } | null> {
  const response = await authFetch('/api/auth/session');
  if (response.status === 401) return null;
  return parseJson(response);
}

export async function checkPermissions(): Promise<BrowserPermissions> {
  return parseJson(await authFetch('/api/auth/permissions'));
}

export async function loginWithPassword(identifier: string, password: string): Promise<{ user: BrowserUser; expiresAt: number }> {
  return parseJson(await authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  }));
}

export async function bootstrapAdmin(input: { email: string; username: string; password: string; bootstrapSecret: string; displayName?: string }): Promise<{ user: BrowserUser; expiresAt: number }> {
  return parseJson(await authFetch('/api/auth/bootstrap', {
    method: 'POST',
    headers: { 'X-Bootstrap-Secret': input.bootstrapSecret },
    body: JSON.stringify({ email: input.email, username: input.username, password: input.password, displayName: input.displayName }),
  }));
}

export async function logout(): Promise<void> {
  const response = await authFetch('/api/auth/logout', { method: 'POST' });
  if (response.status === 204) return;
  await parseJson(response);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ user: BrowserUser; expiresAt: number }> {
  return parseJson(await authFetch('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  }));
}

export function startOAuth(provider: BrowserAuthProvider): void {
  window.location.assign(`/api/auth/oauth/${provider}/start`);
}

async function safeWorkspaceRead(path: string): Promise<unknown> {
  const response = await authFetch(path);
  if (!response.ok) throw new Error(`Workspace probe failed for ${path} (${response.status})`);
  return response.json();
}

export async function loadWorkspace(): Promise<WorkspaceProbe> {
  const [readiness, capabilities, omniRouteStatus] = await Promise.all([
    safeWorkspaceRead('/api/readiness'),
    safeWorkspaceRead('/api/v2/system/capabilities'),
    safeWorkspaceRead('/api/v2/system/status'),
  ]);
  return { readiness, capabilities, omniRouteStatus };
}
