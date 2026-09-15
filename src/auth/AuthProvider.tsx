import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { checkPermissions, checkSession, logout as logoutSession, type BrowserPermissions, type BrowserUser } from './browserSession';

interface AuthContextValue {
  state: 'checking' | 'authenticated' | 'unauthenticated';
  user: BrowserUser | null;
  permissions: BrowserPermissions | null;
  refreshSession: () => Promise<BrowserUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthContextValue['state']>('checking');
  const [user, setUser] = useState<BrowserUser | null>(null);
  const [permissions, setPermissions] = useState<BrowserPermissions | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const session = await checkSession();
      if (!session) {
        setUser(null);
        setPermissions(null);
        setState('unauthenticated');
        throw new Error('Secure browser session is not available.');
      }
      setUser(session.user);
      setState('authenticated');
      try { setPermissions(await checkPermissions()); } catch { setPermissions(null); }
      return session.user;
    } catch (cause) {
      setUser(null);
      setPermissions(null);
      setState('unauthenticated');
      if (cause instanceof Error) throw cause;
      throw new Error('Unable to validate secure browser session.');
    }
  }, []);

  useEffect(() => { void refreshSession().catch(() => undefined); }, [refreshSession]);

  const logout = useCallback(async () => {
    try { await logoutSession(); } finally {
      setUser(null);
      setPermissions(null);
      setState('unauthenticated');
    }
  }, []);

  const value = useMemo(() => ({ state, user, permissions, refreshSession, logout }), [state, user, permissions, refreshSession, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

function SessionCheckScreen() {
  return <div className="min-h-screen bg-[#F5FAFF] flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="h-10 w-10 rounded-full border-[3px] border-cyan-100 border-t-cyan-500 animate-spin"/><span className="text-[11px] font-semibold text-slate-500">Checking secure session…</span></div></div>;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state === 'checking') return <SessionCheckScreen/>;
  if (state !== 'authenticated') return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }}/>;
  return <>{children}</>;
}

export function AnonymousOnlyRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state === 'checking') return <SessionCheckScreen/>;
  if (state === 'authenticated') return <Navigate to="/connecting" replace/>;
  return <>{children}</>;
}
