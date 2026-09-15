import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function WorkspaceTabs({
  tabs,
  active,
  onChange,
  ariaLabel = 'Workspace tabs',
}: {
  tabs: Array<{ id: string; label: string; count?: number | string; disabled?: boolean }>;
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[9.5px] font-bold transition-colors ${active === tab.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'} ${tab.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          role="tab"
          aria-selected={active === tab.id}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-500">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SourcePill({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  } as const;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8.5px] font-bold ${tones[tone]}`}>{label}</span>;
}

export function ProgressBar({ value, max = 100, label }: { value: number | null | undefined; max?: number; label?: string }) {
  const safe = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(max, value));
  const pct = safe == null || max <= 0 ? 0 : Math.min(100, (safe / max) * 100);
  return (
    <div className="min-w-[86px]">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${pct}%` }} />
      </div>
      {label ? <div className="mt-1 text-[8px] text-slate-400">{label}</div> : null}
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, open]);
}

export function InspectorDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = 'max-w-[520px]',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/20 backdrop-blur-[1px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={`h-full w-full ${widthClass} border-l border-slate-200 bg-white shadow-2xl flex flex-col`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1"><h2 className="text-[13px] font-extrabold text-slate-900">{title}</h2>{subtitle ? <div className="mt-1 text-[9.5px] text-slate-500">{subtitle}</div> : null}</div>
          <button type="button" onClick={onClose} aria-label="Close inspector" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={15}/></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEscape(open, onClose);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`max-h-[90vh] w-full ${width} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1"><h2 className="text-[13px] font-extrabold text-slate-900">{title}</h2>{description ? <p className="mt-1 text-[9.5px] leading-relaxed text-slate-500">{description}</p> : null}</div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={15}/></button>
        </header>
        <div className="max-h-[70vh] overflow-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</dl>;
}

export function DetailItem({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5"><dt className="text-[8.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className={`mt-1 break-words text-[10.5px] font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</dd></div>;
}
