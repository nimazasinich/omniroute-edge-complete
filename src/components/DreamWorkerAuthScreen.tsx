import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Network,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import {
  authProviders,
  bootstrapAdmin,
  getAuthStatus,
  loginWithPassword,
  startOAuth,
  type BrowserAuthProvider,
} from '../auth/browserSession';
import { useAuth } from '../auth/AuthProvider';

const providerLabels: Record<BrowserAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
};

type ProviderMap = Record<BrowserAuthProvider, boolean>;

function ProviderLogo({ provider }: { provider: BrowserAuthProvider }) {
  if (provider === 'github') return <span className="text-[10px] font-black tracking-[-.04em]">GH</span>;
  if (provider === 'google') return <span className="text-[15px] font-black text-[#4285F4]">G</span>;
  return <span className="grid h-4 w-4 grid-cols-2 gap-[1px]"><i className="bg-[#F25022]"/><i className="bg-[#7FBA00]"/><i className="bg-[#00A4EF]"/><i className="bg-[#FFB900]"/></span>;
}

export const DreamWorkerAuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderMap>({ google: false, github: false, microsoft: false });
  const [isDark, setIsDark] = useState(false);

  const [bootstrapDisplayName, setBootstrapDisplayName] = useState('Administrator');
  const [bootstrapUsername, setBootstrapUsername] = useState('admin');
  const [bootstrapEmail, setBootstrapEmail] = useState('');
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');

  const oauthError = useMemo(() => new URLSearchParams(location.search).get('error'), [location.search]);

  useEffect(() => {
    let active = true;
    getAuthStatus().then((status) => {
      if (!active) return;
      setBootstrapRequired(status.bootstrapRequired);
      setProviders(status.providers);
      if (status.authenticated) navigate('/connecting', { replace: true });
    }).catch(() => undefined);
    authProviders().then((state) => active && setProviders(state)).catch(() => undefined);
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    if (!oauthError) return;
    const messages: Record<string, string> = {
      oauth_not_configured: 'That sign-in provider is not configured.',
      oauth_state: 'The OAuth verification state was invalid or expired. Please try again.',
      oauth_email: 'The provider did not return a usable verified email address.',
      oauth_not_allowed: 'This account is not allowed to access the control plane.',
      account_disabled: 'This administrator account is disabled.',
      oauth_failed: 'External sign-in failed. Please retry or use your password.',
    };
    setError(messages[oauthError] ?? 'External sign-in could not be completed.');
  }, [oauthError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await loginWithPassword(identifier, password);
      await refreshSession();
      navigate('/connecting', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBootstrap = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await bootstrapAdmin({
        email: bootstrapEmail,
        username: bootstrapUsername,
        password: bootstrapPassword,
        bootstrapSecret,
        displayName: bootstrapDisplayName,
      });
      await refreshSession();
      navigate('/connecting', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Administrator setup failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const configuredProviders = (Object.keys(providerLabels) as BrowserAuthProvider[]).filter((provider) => providers[provider]);

  const pageBg = isDark ? 'bg-[#050b16] text-white' : 'bg-[#f5f9fd] text-slate-950';
  const cardBg = isDark ? 'border-white/10 bg-[#0b1424]/95' : 'border-white bg-white/95';
  const inputBg = isDark ? 'border-white/10 bg-white/[.04] focus-within:bg-white/[.06]' : 'border-slate-200 bg-slate-50/70 focus-within:bg-white';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${pageBg}`}>
      <div className={`pointer-events-none absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_15%_10%,rgba(22,119,255,.16),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(16,185,129,.10),transparent_26%)]' : 'bg-[radial-gradient(circle_at_12%_10%,rgba(59,130,246,.12),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(45,212,191,.12),transparent_26%)]'}`} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px] opacity-90">
        <svg viewBox="0 0 1368 300" className="h-full w-full" preserveAspectRatio="none" fill="none">
          <path d="M0 168C190 99 335 252 548 203C765 153 862 248 1074 191C1194 159 1288 168 1368 202V300H0V168Z" fill="url(#loginWaveA)" opacity=".9" />
          <path d="M0 210C208 145 384 267 620 220C855 173 1041 250 1368 179V300H0V210Z" fill="url(#loginWaveB)" opacity=".7" />
          <defs>
            <linearGradient id="loginWaveA" x1="0" y1="0" x2="1368" y2="0"><stop stopColor="#60a5fa"/><stop offset=".55" stopColor="#22d3ee"/><stop offset="1" stopColor="#34d399"/></linearGradient>
            <linearGradient id="loginWaveB" x1="0" y1="0" x2="1368" y2="0"><stop stopColor="#bfdbfe"/><stop offset=".48" stopColor="#a5f3fc"/><stop offset="1" stopColor="#a7f3d0"/></linearGradient>
          </defs>
        </svg>
      </div>

      <header className="relative z-10 mx-auto flex h-[86px] max-w-[1280px] items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(145deg,#0f6fff,#16b8d9_58%,#28c995)] text-white shadow-[0_10px_28px_rgba(15,111,255,.22)]"><Cloud size={22} strokeWidth={2.2} /></div>
          <div className="hidden sm:block">
            <div className="text-[17px] font-black leading-tight tracking-[-.03em]">Cloudflare AI Router</div>
            <div className={`text-[10px] font-semibold uppercase tracking-[.14em] ${mutedText}`}>OmniRoute Control Plane</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDark((value) => !value)}
            aria-label="Toggle theme"
            className={`grid h-9 w-9 place-items-center rounded-xl border transition ${isDark ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition ${isDark ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            EN <ChevronDown size={13} />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-86px-64px)] max-w-[1180px] grid-cols-1 items-center gap-14 px-8 py-10 lg:grid-cols-[.98fr_1.02fr]">
        <section className={`mx-auto w-full max-w-[440px] rounded-[26px] border p-8 shadow-[0_28px_80px_rgba(15,35,70,.14)] backdrop-blur-xl transition-colors duration-300 ${cardBg}`}>
          <h2 className="text-[28px] font-black tracking-[-.035em]">Welcome back</h2>
          <p className={`mt-1.5 text-[12.5px] font-medium ${mutedText}`}>Sign in to your OmniRoute control plane</p>

          {error ? (
            <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] font-semibold text-rose-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}><X size={14} /></button>
            </div>
          ) : null}
          {bootstrapRequired ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[10.5px] leading-5 text-amber-900">
              <b>First administrator setup is required.</b> Create the real browser admin before signing in.{' '}
              <button type="button" className="ml-1 font-black text-amber-950 underline underline-offset-2" onClick={() => setBootstrapOpen(true)}>Initialize admin</button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[12px] font-bold">Username or email</span>
              <span className={`flex h-[50px] items-center gap-3 rounded-xl border px-4 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 ${inputBg}`}>
                <Mail size={17} className={mutedText} />
                <input autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="admin or admin@example.com" required className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:font-medium placeholder:text-slate-400" />
              </span>
              <span className={`mt-1.5 block text-[9.5px] font-medium ${mutedText}`}>Admin username also works here.</span>
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between">
                <b className="text-[12px] font-bold">Password</b>
                <button type="button" className="text-[10.5px] font-bold text-blue-500" onClick={() => setError('Password recovery is administrator-controlled. Use the configured recovery procedure if needed.')}>Forgot password?</button>
              </span>
              <span className={`flex h-[50px] items-center gap-3 rounded-xl border px-4 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 ${inputBg}`}>
                <Lock size={17} className={mutedText} />
                <input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className={mutedText}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </span>
            </label>

            <button disabled={isSubmitting} type="submit" className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#1668e3,#0e9fd0_55%,#16a879)] text-[12.5px] font-black text-white shadow-[0_12px_28px_rgba(14,159,208,.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55">
              {isSubmitting ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} />
            </button>
          </form>

          {configuredProviders.length ? (
            <>
              <div className={`my-5 flex items-center gap-3 text-[10px] font-semibold ${mutedText} before:h-px before:flex-1 before:bg-current before:opacity-15 after:h-px after:flex-1 after:bg-current after:opacity-15`}>or continue with</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${configuredProviders.length}, minmax(0,1fr))` }}>
                {configuredProviders.map((provider) => (
                  <button key={provider} type="button" onClick={() => startOAuth(provider)} className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-[10.5px] font-bold transition ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <ProviderLogo provider={provider} />{providerLabels[provider]}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className={`mt-6 text-center text-[11.5px] font-semibold ${mutedText}`}>
            Don't have an account?{' '}
            {bootstrapRequired ? (
              <button type="button" className="font-black text-blue-500" onClick={() => setBootstrapOpen(true)}>Initialize administrator</button>
            ) : (
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Contact your administrator</span>
            )}
          </div>

          <div className={`mt-6 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[9.5px] font-semibold leading-4 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
            <KeyRound size={15} className="shrink-0 text-emerald-500" />
            Browser admin credentials create a server-side session; they are not gateway API keys.
          </div>
        </section>

        <section className="mx-auto max-w-[520px] lg:mx-0">
          <div className={`text-[10px] font-black uppercase tracking-[.2em] ${mutedText}`}>Secure control plane access</div>
          <h1 className="mt-4 text-[46px] font-black leading-[1.02] tracking-[-.045em] sm:text-[54px]">
            One control plane.<br />
            <span className="bg-[linear-gradient(90deg,#1769e0,#0fa8cf_52%,#16a477)] bg-clip-text text-transparent">Real routing data.</span>
          </h1>
          <p className={`mt-5 max-w-[460px] text-[14.5px] font-medium leading-7 ${mutedText}`}>
            Sign in to the Cloudflare-hosted OmniRoute control plane. Browser authentication stays separate from gateway API keys, and routing authority remains with OmniRoute.
          </p>

          <div className="mt-8 grid max-w-[480px] grid-cols-3 gap-3">
            {[
              [ShieldCheck, 'Server sessions', 'Revocable browser auth'],
              [Network, 'OmniRoute authority', 'No second edge router'],
              [KeyRound, 'Scoped API keys', 'Kept apart from login'],
            ].map(([Icon, title, detail]) => {
              const C = Icon as React.ComponentType<{ size?: number; className?: string }>;
              return (
                <div key={String(title)} className={`rounded-2xl border p-4 backdrop-blur-xl ${isDark ? 'border-white/10 bg-white/[.03]' : 'border-white/80 bg-white/75 shadow-[0_14px_40px_rgba(30,64,175,.07)]'}`}>
                  <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white"><C size={17} /></div>
                  <div className="text-[11px] font-black">{String(title)}</div>
                  <div className={`mt-1 text-[9px] font-medium leading-4 ${mutedText}`}>{String(detail)}</div>
                </div>
              );
            })}
          </div>

          <p className={`mt-8 max-w-[420px] text-[13px] font-medium italic leading-6 ${mutedText}`}>
            "The fastest routing decision is the one an operator can actually see happen."
          </p>
        </section>
      </main>

      <footer className={`relative z-10 mx-auto flex h-16 max-w-[1280px] items-center justify-between px-8 text-[10.5px] font-semibold ${mutedText}`}>
        <span>Cloudflare AI Router &middot; OmniRoute control plane.</span>
        <span className="flex items-center gap-4">
          <span>v1.8.0</span>
          <a href="#" className="hover:underline">Documentation</a>
          <a href="#" className="hover:underline">Support</a>
        </span>
      </footer>

      {bootstrapOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071327]/50 p-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <form onSubmit={handleBootstrap} className="w-full max-w-[500px] rounded-[24px] border border-white bg-white p-6 text-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[linear-gradient(145deg,#0f6fff,#16b8d9_58%,#28c995)] text-white"><Cloud size={16} /></span><strong className="text-[12px]">Cloudflare AI Router</strong></div>
                <h3 className="text-[22px] font-black tracking-[-.035em] text-slate-950">Initialize administrator</h3>
                <p className="mt-1 text-[10.5px] leading-5 text-slate-500">Create the first D1-backed browser administrator. This flow closes after the first admin exists.</p>
              </div>
              <button type="button" onClick={() => setBootstrapOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="col-span-2"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-slate-500">Display name</span><input value={bootstrapDisplayName} onChange={(e) => setBootstrapDisplayName(e.target.value)} placeholder="Administrator" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-400" /></label>
              <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-slate-500">Admin username</span><input value={bootstrapUsername} onChange={(e) => setBootstrapUsername(e.target.value.toLowerCase())} placeholder="admin" autoComplete="username" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-400" required /></label>
              <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-slate-500">Admin email</span><input value={bootstrapEmail} onChange={(e) => setBootstrapEmail(e.target.value)} type="email" placeholder="admin@example.com" autoComplete="email" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-400" required /></label>
              <label className="col-span-2"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-slate-500">Administrator password</span><input value={bootstrapPassword} onChange={(e) => setBootstrapPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="Strong password &middot; 12+ characters" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-400" required /></label>
              <label className="col-span-2"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-slate-500">BOOTSTRAP_SECRET</span><input value={bootstrapSecret} onChange={(e) => setBootstrapSecret(e.target.value)} type="password" placeholder="Paste the configured one-time bootstrap secret" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-400" required /></label>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2.5 text-[9.5px] font-semibold text-blue-800"><span className="flex items-center gap-2"><Check size={14} /> Username and email will both remain valid sign-in identifiers.</span></div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setBootstrapOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[10px] font-bold text-slate-600">Cancel</button>
              <button disabled={isSubmitting} className="rounded-xl bg-slate-950 px-5 py-2.5 text-[10px] font-black text-white disabled:opacity-50">{isSubmitting ? 'Creating administrator…' : 'Create administrator'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};
