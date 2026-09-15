import React, { useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';
import type { DashboardData, SecurityEvent } from '../types';
import { formatFullDateTime, formatNumber } from '../utils/formatters';
import { MetricTile, PageHeader, SourceBadge } from './PagePrimitives';
import { DetailGrid, DetailItem, InspectorDrawer, ProgressBar, SourcePill, WorkspaceTabs } from './WorkspacePrimitives';

export const FirewallView: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [query,setQuery] = useState('');
  const [severity,setSeverity] = useState('all');
  const [action,setAction] = useState('all');
  const [view,setView] = useState('Events');
  const [selected,setSelected] = useState<SecurityEvent|null>(null);
  const rows = useMemo(()=>data.securityEvents.filter((event)=>{
    if (severity !== 'all' && event.severity.toLowerCase() !== severity) return false;
    if (action !== 'all' && event.action.toLowerCase() !== action) return false;
    const term=query.trim().toLowerCase();
    return !term || [event.eventType,event.sourceIp,event.details,event.ruleTriggered].some((value)=>String(value??'').toLowerCase().includes(term));
  }),[action,data.securityEvents,query,severity]);
  const blocked=data.securityEvents.filter((e)=>e.action==='Blocked').length;
  const high=data.securityEvents.filter((e)=>e.severity==='High'||e.severity==='Critical').length;
  const severityCounts = useMemo(()=>['Critical','High','Medium','Low'].map((name)=>({name,count:data.securityEvents.filter((event)=>event.severity===name).length})),[data.securityEvents]);
  const maxSeverity=Math.max(1,...severityCounts.map((row)=>row.count));
  const topSources=useMemo(()=>{
    const map=new Map<string,number>();
    data.securityEvents.forEach((event)=>{const key=event.sourceIp||'Unknown';map.set(key,(map.get(key)||0)+1)});
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
  },[data.securityEvents]);

  return <div className="flex flex-col gap-3 h-full w-full overflow-y-auto pr-1">
    <PageHeader icon={ShieldAlert} tone="rose" title="Security event explorer" badge="Observed events" description="Security Event Explorer data comes from observed edge security events only. No local prompt firewall is claimed active, and absence of events is not interpreted as a healthy security posture." actions={<button onClick={()=>data.refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-blue-700"><RefreshCw size={12} className={data.loading?'animate-spin':''}/>Refresh</button>} />
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5"><MetricTile label="Recorded events" value={formatNumber(data.securityEvents.length)} note="Data source: security event store"/><MetricTile label="Blocked actions" value={data.securityEvents.length ? formatNumber(blocked) : '—'} note="Observed action only"/><MetricTile label="High / critical" value={data.securityEvents.length ? formatNumber(high) : '—'} note="Observed Severity only"/><MetricTile label="Prompt firewall" value="Not integrated" note="No local prompt firewall"/></section>
    <section className="card-3d-glass p-3"><WorkspaceTabs tabs={[{id:'Events',label:'Events',count:data.securityEvents.length},{id:'Breakdown',label:'Breakdown'},{id:'Sources',label:'Top sources'}]} active={view} onChange={setView}/></section>

    {view==='Breakdown'?<section className="card-3d-glass p-4"><div className="flex items-center gap-2"><h3 className="text-[12px] font-bold">Severity distribution</h3><SourceBadge>Observed event telemetry</SourceBadge></div><div className="mt-4 grid gap-3">{severityCounts.map((row)=><div key={row.name}><div className="mb-1 flex justify-between text-[9.5px]"><span>{row.name}</span><span className="font-mono">{row.count}</span></div><ProgressBar value={row.count} max={maxSeverity}/></div>)}</div><p className="mt-4 text-[9px] text-slate-500">This chart counts stored events only. It is not a threat-detection coverage score.</p></section>:null}
    {view==='Sources'?<section className="card-3d-glass p-4"><div className="flex items-center gap-2"><h3 className="text-[12px] font-bold">Top observed source addresses</h3><SourceBadge>Observed events</SourceBadge></div><div className="mt-4 grid gap-2">{topSources.map(([source,count])=><div key={source} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"><span className="min-w-[150px] font-mono text-[9.5px] text-slate-700">{source}</span><div className="flex-1"><ProgressBar value={count} max={topSources[0]?.[1]||1}/></div><span className="w-10 text-right font-mono text-[9px] text-slate-500">{count}</span></div>)}{!topSources.length?<div className="p-8 text-center text-[10px] text-slate-500">No source observations are available.</div>:null}</div></section>:null}

    {view==='Events'?<section className="card-3d-glass p-4 flex-1 min-h-[390px]">
      <div className="flex flex-wrap items-center gap-2 mb-3"><div className="mr-auto"><div className="flex items-center gap-2"><h3 className="text-[12px] font-bold">Security events</h3><SourceBadge>Observed event telemetry</SourceBadge></div><p className="text-[9.5px] text-slate-500 mt-1">Select a row for full event detail. Severity and Action values are displayed exactly from stored events after normalization.</p></div><label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 h-8 bg-white"><Search size={12}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search event, rule, IP" className="outline-none text-[10px] w-[170px]"/></label><select aria-label="Severity" value={severity} onChange={(e)=>setSeverity(e.target.value)} className="h-8 border border-slate-200 rounded-lg bg-white px-2 text-[10px]"><option value="all">Severity: All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Action" value={action} onChange={(e)=>setAction(e.target.value)} className="h-8 border border-slate-200 rounded-lg bg-white px-2 text-[10px]"><option value="all">Action: All</option><option value="blocked">Blocked</option><option value="allowed">Allowed</option><option value="logged">Logged</option></select></div>
      <div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[900px] text-left text-[10px]"><thead className="bg-slate-50 text-slate-500 sticky top-0"><tr><th className="p-2">Time</th><th className="p-2">Event</th><th className="p-2">Severity</th><th className="p-2">Action</th><th className="p-2">Source</th><th className="p-2">Rule / detail</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((event,index)=><tr key={event.id??index} onClick={()=>setSelected(event)} className="cursor-pointer hover:bg-rose-50/30"><td className="p-2 font-mono">{event.timestamp?formatFullDateTime(event.timestamp):'—'}</td><td className="p-2 font-semibold text-slate-800">{event.eventType}</td><td className="p-2"><SourcePill label={event.severity} tone={event.severity==='Critical'||event.severity==='High'?'rose':event.severity==='Medium'?'amber':'slate'}/></td><td className="p-2">{event.action}</td><td className="p-2 font-mono">{event.sourceIp||'—'}</td><td className="p-2 text-slate-500 max-w-[360px]">{event.ruleTriggered||event.details||'—'}</td></tr>)}{!rows.length&&<tr><td colSpan={6} className="p-10 text-center text-slate-500">{data.securityEvents.length ? 'No event matches this filter.' : 'No observed security events are present in the current dataset.'}</td></tr>}</tbody></table></div>
    </section>:null}

    <InspectorDrawer open={Boolean(selected)} onClose={()=>setSelected(null)} title="Security event detail" subtitle={selected?.id ? <span className="font-mono">{selected.id}</span> : undefined}>
      {selected?<div className="space-y-3"><DetailGrid><DetailItem label="Time" value={selected.timestamp?formatFullDateTime(selected.timestamp):'Unknown'}/><DetailItem label="Event type" value={selected.eventType}/><DetailItem label="Severity" value={selected.severity}/><DetailItem label="Action" value={selected.action}/><DetailItem label="Source IP" value={selected.sourceIp||'Not observed'} mono/><DetailItem label="Rule" value={selected.ruleTriggered||'Not observed'}/></DetailGrid><div className="rounded-xl border border-slate-200 p-3"><strong className="text-[10px]">Observed detail</strong><p className="mt-2 text-[9.5px] text-slate-500">{selected.details||'No additional detail recorded.'}</p></div></div>:null}
    </InspectorDrawer>
  </div>;
};
