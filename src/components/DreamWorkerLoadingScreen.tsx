import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, RotateCcw, ShieldCheck } from 'lucide-react';
import { checkPermissions, checkSession, loadWorkspace } from '../auth/browserSession';
import { useAuth } from '../auth/AuthProvider';

type PhaseState = 'pending' | 'active' | 'complete' | 'error';
type Phase = { id: number; label: string; activeDetail: string; completeDetail: string };

const MIN_LOADING_MS = 1450;
// Labels mirror the reference stepper (Authenticating / Loading workspace / Checking permissions / Almost there)
// while still driving the real session, workspace, and permission checks underneath.
const phases: Phase[] = [
  { id: 1, label: 'Authenticating', activeDetail: 'Validating server session…', completeDetail: 'Session verified' },
  { id: 2, label: 'Loading workspace', activeDetail: 'Reading live system APIs…', completeDetail: 'Control APIs ready' },
  { id: 3, label: 'Checking permissions', activeDetail: 'Reading permission contract…', completeDetail: 'Permissions verified' },
  { id: 4, label: 'Almost there…', activeDetail: 'Preparing your workspace…', completeDetail: 'Dashboard ready' },
];

const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export const DreamWorkerLoadingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession, logout } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  const run = useCallback(async (cancelled: () => boolean) => {
    const startedAt = performance.now();
    let activeStep = 1;
    setError(null);
    setFailedStep(null);
    setCurrentStep(1);
    try {
      const session = await checkSession();
      if (!session) { navigate('/signin', { replace: true }); return; }
      await refreshSession();
      if (cancelled()) return;

      activeStep = 2;
      setCurrentStep(2);
      await loadWorkspace();
      if (cancelled()) return;

      activeStep = 3;
      setCurrentStep(3);
      await checkPermissions();
      if (cancelled()) return;

      activeStep = 4;
      setCurrentStep(4);
      const remaining = Math.max(0, MIN_LOADING_MS - (performance.now() - startedAt));
      if (remaining > 0) await pause(remaining);
      if (!cancelled()) navigate('/', { replace: true });
    } catch (cause) {
      if (cancelled()) return;
      setFailedStep(activeStep);
      setError(cause instanceof Error ? cause.message : 'Unable to open the control plane.');
    }
  }, [navigate, refreshSession]);

  useEffect(() => {
    let isCancelled = false;
    void run(() => isCancelled);
    return () => { isCancelled = true; };
  }, [run, runId]);

  const stateFor = (id: number): PhaseState => {
    if (failedStep === id) return 'error';
    if (id < currentStep) return 'complete';
    if (id === currentStep) return 'active';
    return 'pending';
  };

  const completedCount = useMemo(() => phases.filter((phase) => stateFor(phase.id) === 'complete').length, [currentStep, failedStep]);
  const progress = error ? Math.max(8, ((currentStep - 1) / phases.length) * 100) : Math.max(8, ((completedCount + .45) / phases.length) * 100);
  const activePhase = phases.find((phase) => phase.id === currentStep) ?? phases[0];

  const backToSignIn = async () => {
    try { await logout(); } catch { /* session may already be invalid */ }
    navigate('/signin', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f9fd] text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(59,130,246,.13),transparent_28%),radial-gradient(circle_at_80%_32%,rgba(45,212,191,.11),transparent_26%)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[320px] opacity-90">
        <svg viewBox="0 0 1368 320" className="h-full w-full" preserveAspectRatio="none" fill="none">
          <path d="M0 178C190 109 335 262 548 213C765 163 862 258 1074 201C1194 169 1288 178 1368 212V320H0V178Z" fill="url(#loadWaveA)" opacity=".9" />
          <path d="M0 220C208 155 384 277 620 230C855 183 1041 260 1368 189V320H0V220Z" fill="url(#loadWaveB)" opacity=".7" />
          <defs>
            <linearGradient id="loadWaveA" x1="0" y1="0" x2="1368" y2="0"><stop stopColor="#60a5fa"/><stop offset=".55" stopColor="#22d3ee"/><stop offset="1" stopColor="#34d399"/></linearGradient>
            <linearGradient id="loadWaveB" x1="0" y1="0" x2="1368" y2="0"><stop stopColor="#bfdbfe"/><stop offset=".48" stopColor="#a5f3fc"/><stop offset="1" stopColor="#a7f3d0"/></linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-14">
        <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-[linear-gradient(145deg,#0f6fff,#16b8d9_58%,#28c995)] text-white shadow-[0_18px_44px_rgba(15,111,255,.22)]"><Cloud size={38} strokeWidth={2.1} /></div>
        <div className="mt-3 text-[19px] font-black tracking-[-.035em]">Cloudflare AI Router</div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">OmniRoute Control Plane</div>

        <div className="relative mt-10 grid h-[140px] w-[140px] place-items-center">
          <div className={`absolute inset-0 rounded-full ${error ? 'bg-rose-100' : 'animate-spin [animation-duration:1.6s] bg-[conic-gradient(from_25deg,#1d6ef0_0deg,#22d3ee_120deg,#22c58a_235deg,rgba(255,255,255,.15)_320deg,#1d6ef0_360deg)] shadow-[0_0_50px_rgba(37,153,210,.18)]'}`} />
          <div className="absolute inset-[7px] rounded-full bg-[#f5f9fd]" />
        </div>

        <h1 className="mt-8 text-[30px] font-black tracking-[-.03em]">{error ? 'Signing you in needs attention' : 'Signing you in…'}</h1>
        <p className="mt-2 text-[13px] font-medium text-slate-500">{error ? 'A control-plane check failed before reaching your workspace.' : 'Connecting to your environment'}</p>

        <div className="mt-10 flex w-full max-w-[640px] items-start justify-between">
          {phases.map((phase, index) => {
            const state = stateFor(phase.id);
            const complete = state === 'complete';
            const active = state === 'active';
            const failed = state === 'error';
            return (
              <React.Fragment key={phase.id}>
                <div className="flex flex-1 flex-col items-center text-center">
                  <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${failed ? 'bg-rose-500' : complete ? 'bg-emerald-500' : active ? 'bg-[#1d9bd8]' : 'bg-slate-300'}`}>
                    {active && !failed ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> : null}
                  </span>
                  <span className={`mt-2 max-w-[110px] text-[11px] font-bold leading-4 ${failed ? 'text-rose-600' : complete ? 'text-emerald-700' : active ? 'text-slate-900' : 'text-slate-400'}`}>{phase.label}</span>
                </div>
                {index < phases.length - 1 ? <div className={`mt-[6px] h-px flex-[1.4] ${phase.id < currentStep && !failed ? 'bg-emerald-300' : 'bg-slate-200'}`} /> : null}
              </React.Fragment>
            );
          })}
        </div>

        <div className="mt-6 h-1.5 w-full max-w-[420px] overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full transition-[width] duration-500 ${error ? 'bg-rose-400' : 'bg-[linear-gradient(90deg,#1769e0,#11add1,#1eb782)]'}`} style={{ width: `${progress}%` }} />
        </div>

        {error ? (
          <div className="mt-8 flex w-full max-w-[520px] flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center">
            <div className="flex items-center gap-2 text-[11.5px] font-bold text-rose-700"><RotateCcw size={15} />{error}</div>
            <div className="flex gap-2">
              <button onClick={() => setRunId((value) => value + 1)} className="rounded-xl bg-slate-950 px-4 py-2 text-[10px] font-black text-white">Retry checks</button>
              <button onClick={() => void backToSignIn()} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-[10px] font-black text-rose-700">Back to sign in</button>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex items-center gap-2 rounded-2xl border border-slate-100 bg-white/80 px-4 py-2.5 text-[10.5px] font-semibold text-slate-500 shadow-sm backdrop-blur">
            <ShieldCheck size={15} className="text-emerald-600" />
            Your data stays private and secure. {activePhase.activeDetail}
          </div>
        )}
      </div>
    </div>
  );
};
