import React, { useState } from 'react';
import { Gauge, KeyRound, LockKeyhole, ShieldCheck, Waypoints } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DashboardData } from '../types';
import { MetricTile, PageHeader, SourceBadge } from './PagePrimitives';
import { DetailGrid, DetailItem, InspectorDrawer, ProgressBar, SourcePill } from './WorkspacePrimitives';

export const SecurityPoliciesView: React.FC<{ data: DashboardData }> = ({ data }) => {
  const c = data.capabilities;
  const navigate = useNavigate();
  const controls = [
    { name: 'Gateway authentication', enabled: c?.gatewayAuthentication === true, detail: 'Bearer key authentication executes before OmniRoute.', icon: KeyRound, source: 'gateway code', action: 'Enforced when configured' },
    { name: 'Rate limiting', enabled: c?.perKeyRateLimiting === true, detail: 'Per-key Cloudflare rate-limit binding is required; missing binding fails closed.', icon: Gauge, source: 'edge capability', action: 'Cloudflare binding' },
    { name: 'Origin validation', enabled: c?.originValidation === true, detail: 'Only HTTPS origins are accepted, except explicit localhost development.', icon: LockKeyhole, source: 'origin validator', action: 'Fail-closed validation' },
    { name: 'Provider routing policy', enabled: false, detail: 'Owned by OmniRoute; no local scoring policy is executed.', icon: Waypoints, source: 'OmniRoute authority', action: 'Engine-owned' },
    { name: 'Prompt firewall', enabled: false, detail: 'No local prompt firewall is implemented or claimed active.', icon: ShieldCheck, source: 'not integrated', action: 'Unavailable' },
  ];
  const [selected, setSelected] = useState<(typeof controls)[number] | null>(null);
  const implemented = controls.filter((row)=>row.enabled).length;
  const readinessIssues = data.readiness?.issues ?? [];
  const coveragePct = Math.round((implemented / controls.length) * 100);

  return <div className="flex flex-col gap-3 h-full w-full overflow-y-auto pr-1">
    <PageHeader icon={ShieldCheck} title="Security Policies" badge="Capability view" description="Enforcement inventory derived from implemented edge capabilities and observed security telemetry, not configuration guesses." actions={<button onClick={()=>navigate('/firewall')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-700">Open Security Events →</button>}/>
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5"><MetricTile label="Implemented controls" value={`${implemented}/${controls.length}`} note="Capability inspection only"/><MetricTile label="Observed security events" value={String(data.securityEvents.length)} note="Data source: persisted events"/><MetricTile label="Deployment readiness" value={data.readiness ? (data.readiness.ready ? 'Ready' : 'Issues') : 'Unknown'} note={data.readiness ? `${readinessIssues.length} reported issue(s)` : 'Readiness API unavailable'}/><MetricTile label="Prompt firewall" value="Not integrated" note="No local prompt firewall claim"/></section>

    <section className="card-3d-glass p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-[12px] font-bold">Enforcement inventory</h3><SourceBadge>Capability contract</SourceBadge></div><p className="text-[9.5px] text-slate-500 mt-1">Capability coverage is not a security posture score. “Implemented” only means the code capability exists.</p></div><div className="min-w-[180px]"><div className="mb-1 flex justify-between text-[9px] text-slate-500"><span>Capability coverage</span><b>{coveragePct}%</b></div><ProgressBar value={coveragePct}/></div></div><div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">{controls.map(({name,enabled,detail,icon:Icon,source})=><button key={name} onClick={()=>setSelected(controls.find((item)=>item.name===name)??null)} className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-200 hover:bg-blue-50/20"><div className="flex items-center gap-2"><Icon size={14} className={enabled?'text-emerald-600':'text-slate-400'}/><strong className="text-[10.5px]">{name}</strong><SourcePill label={enabled?'Implemented':'Not integrated'} tone={enabled?'green':'slate'}/></div><p className="mt-2 text-[9.5px] leading-relaxed text-slate-500">{detail}</p><div className="mt-2 text-[8.5px] text-slate-400">Source: {source}</div></button>)}</div></section>

    <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 flex-1 min-h-[260px]">
      <div className="card-3d-glass p-4"><div className="flex justify-between mb-3"><div><h3 className="text-[12px] font-bold">Observed security evidence</h3><p className="text-[9.5px] text-slate-500">Data source: observed security events only.</p></div><span className="text-[10px] font-mono text-slate-500">{data.securityEvents.length} events</span></div>{data.securityEvents.length ? <div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full text-[9.5px]"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-2 text-left">Event</th><th className="p-2 text-left">Severity</th><th className="p-2 text-left">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{data.securityEvents.slice(0,20).map((e,i)=><tr key={e.id??i}><td className="p-2 font-semibold">{e.eventType}</td><td className="p-2">{e.severity}</td><td className="p-2">{e.action}</td></tr>)}</tbody></table></div> : <div className="h-[150px] flex items-center justify-center text-[10.5px] text-slate-500">No security events are present in the current dataset.</div>}</div>
      <div className="card-3d-glass p-4"><h3 className="text-[12px] font-bold">Deployment readiness</h3><p className="text-[9.5px] text-slate-500 mt-1">Readiness is not inferred from implemented code.</p><div className="mt-3 grid gap-2">{data.readiness ? (readinessIssues.length ? readinessIssues.map((issue)=><div key={issue} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[9.5px] text-amber-800"><div className="font-bold">Needs attention</div><div className="mt-1">{issue}</div></div>) : <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[9.5px] text-emerald-800">Readiness endpoint reports no issues.</div>) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[9.5px] text-slate-500">Readiness data unavailable.</div>}</div></div>
    </section>

    <InspectorDrawer open={Boolean(selected)} onClose={()=>setSelected(null)} title="Policy capability detail" subtitle={selected?.name}>
      {selected ? <div className="space-y-3"><DetailGrid><DetailItem label="Capability" value={selected.name}/><DetailItem label="Enforcement status" value={selected.enabled?'Implemented':'Not integrated'}/><DetailItem label="Source" value={selected.source}/><DetailItem label="Action model" value={selected.action}/></DetailGrid><div className="rounded-xl border border-slate-200 p-3 text-[9.5px] text-slate-500">{selected.detail}</div><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[9px] text-blue-900">Last-enforcement timestamp is not available from the current capability contract, so no policy timeline is fabricated.</div></div> : null}
    </InspectorDrawer>
  </div>;
};
