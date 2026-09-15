import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Database, Info } from 'lucide-react';

export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  actions,
  tone = 'blue',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  actions?: React.ReactNode;
  tone?: 'blue' | 'violet' | 'amber' | 'rose' | 'emerald' | 'slate';
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  }[tone];
  return (
    <section className="card-3d-glass p-4 flex flex-wrap items-center gap-3 shrink-0">
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${toneClass}`}><Icon size={18}/></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
          {badge ? <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600">{badge}</span> : null}
        </div>
        <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </section>
  );
}

export function MetricTile({ label, value, note, icon: Icon }: { label: string; value: React.ReactNode; note?: string; icon?: LucideIcon }) {
  return (
    <div className="card-3d-glass p-3 min-w-0">
      <div className="flex items-center gap-2 text-slate-500">{Icon ? <Icon size={13}/> : null}<span className="text-[9.5px] font-semibold">{label}</span></div>
      <strong className="block mt-1 text-[17px] leading-tight text-slate-900 truncate" title={typeof value === 'string' ? value : undefined}>{value}</strong>
      {note ? <small className="block mt-1 text-[8.8px] leading-relaxed text-slate-500">{note}</small> : null}
    </div>
  );
}

export function SourceBadge({ children = 'Data source' }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[8.5px] font-semibold text-slate-600"><Database size={9}/>{children}</span>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-h-[150px] rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center text-center px-5">
      <Info size={18} className="text-slate-400 mb-2"/>
      <strong className="text-[11px] text-slate-700">{title}</strong>
      <p className="text-[9.5px] text-slate-500 mt-1 max-w-[520px] leading-relaxed">{detail}</p>
    </div>
  );
}

export function DataNotice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-[9.5px] leading-relaxed text-blue-900 flex items-start gap-2"><Info size={12} className="mt-0.5 shrink-0"/>{children}</div>;
}
