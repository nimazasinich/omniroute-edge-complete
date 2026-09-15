import React, { useMemo, useState } from 'react';
import { Activity, GitMerge, Network, PlugZap, Search } from 'lucide-react';
import type { DashboardData, RoutingDecision } from '../types';
import { formatDateTime, formatLatency, formatNumber } from '../utils/formatters';
import { MetricTile, PageHeader, SourceBadge } from './PagePrimitives';
import { DetailGrid, DetailItem, InspectorDrawer, ProgressBar, SourcePill, WorkspaceTabs } from './WorkspacePrimitives';

export const RoutingRulesView: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'errors'>('all');
  const [workspace, setWorkspace] = useState('Outcomes');
  const [selected, setSelected] = useState<RoutingDecision | null>(null);
  const status = data.omniRouteStatus;
  const requestTypes = useMemo(() => Array.from(new Set(data.history.map((item) => item.requestType).filter(Boolean))).sort(), [data.history]);
  const rows = useMemo(() => data.history.filter((item) => {
    if (typeFilter !== 'all' && item.requestType !== typeFilter) return false;
    const isError = item.routingReason.toLowerCase().includes('error');
    if (outcomeFilter === 'errors' && !isError) return false;
    const term = query.trim().toLowerCase();
    return !term || [item.requestType, item.selectedModel, item.providerId, item.routingReason].some((value) => String(value ?? '').toLowerCase().includes(term));
  }), [data.history, outcomeFilter, query, typeFilter]);
  const errors = data.history.filter((item) => item.routingReason.toLowerCase().includes('error')).length;
  const maxTypeCount = Math.max(1, ...requestTypes.map((type) => data.history.filter((item) => item.requestType === type).length));

  return <div className="flex flex-col gap-3 h-full w-full overflow-y-auto pr-1">
    <PageHeader icon={GitMerge} tone="amber" title="Routing Status" badge="Read-only" description="Routing authority is OmniRoute. This workspace observes request outcomes and current routing explainability without scoring providers or simulating fallback locally." />
    <section className="grid grid-cols-2 xl:grid-cols-5 gap-2.5">
      <MetricTile icon={Network} label="Routing authority" value="OmniRoute" note="Single routing authority" />
      <MetricTile icon={PlugZap} label="OmniRoute connectivity" value={status?.reachable === true ? 'Reachable' : status?.reachable === false ? 'Unreachable' : status?.configured ? 'Unknown' : 'Not configured'} note={status?.latencyMs != null ? `${status.latencyMs} ms probe` : status?.error ?? '/v1/models probe'} />
      <MetricTile icon={Activity} label="Observed request outcomes" value={formatNumber(data.history.length)} note="Edge-observed routing history" />
      <MetricTile label="Error-labelled outcomes" value={formatNumber(errors)} note="Derived only from stored routing reason" />
      <MetricTile label="Management API" value="Not connected" note="Rule editing remains unavailable" />
    </section>

    <section className="card-3d-glass p-3"><WorkspaceTabs tabs={[{id:'Outcomes',label:'Observed outcomes',count:data.history.length},{id:'Distribution',label:'Request distribution'},{id:'Explainability',label:'Explainability'}]} active={workspace} onChange={setWorkspace}/></section>

    {workspace === 'Distribution' ? <section className="grid grid-cols-1 xl:grid-cols-2 gap-3"><div className="card-3d-glass p-4"><h3 className="text-[12px] font-bold">Request-type distribution</h3><p className="mt-1 text-[9.5px] text-slate-500">Observed request types only.</p><div className="mt-4 grid gap-3">{requestTypes.map((type)=>{const count=data.history.filter((item)=>item.requestType===type).length;return <div key={type}><div className="mb-1 flex justify-between text-[9.5px]"><span>{type}</span><span className="font-mono">{count}</span></div><ProgressBar value={count} max={maxTypeCount}/></div>})}{!requestTypes.length?<p className="text-[10px] text-slate-500">No request types observed.</p>:null}</div></div><div className="card-3d-glass p-4"><h3 className="text-[12px] font-bold">Latency distribution</h3><p className="mt-1 text-[9.5px] text-slate-500">No synthetic histogram is generated because the current dataset does not expose a dedicated histogram series. Individual observed latencies remain available in the Outcomes table.</p><div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-[10px] text-slate-500">Histogram unavailable from current source.</div></div></section> : null}

    {workspace === 'Explainability' ? <section className="card-3d-glass p-4"><div className="flex items-center justify-between"><div><h3 className="text-[12px] font-bold">OmniRoute routing explainability</h3><p className="mt-1 text-[9.5px] text-slate-500">OmniRoute 3.8.50 exposes current/snapshot routing explainability through the version-gated backend integration.</p></div><SourcePill label="OMNIROUTE-DERIVED" tone="amber"/></div><div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2"><DetailItem label="Request-specific decision" value="Unavailable on 3.8.50"/><DetailItem label="Auto candidate read" value="Unavailable on 3.8.50"/><DetailItem label="Fallback attempts" value="Not observed"/></div><div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[9.5px] text-amber-800">No request-specific score, winner, or fallback chain is reconstructed in the UI. Current explainability is displayed only when OmniRoute supplies it.</div></section> : null}

    {workspace === 'Outcomes' ? <section className="card-3d-glass p-4 flex-1 min-h-[380px]">
      <div className="flex flex-wrap items-center gap-2 mb-3"><div className="mr-auto"><div className="flex items-center gap-2"><h3 className="text-[12px] font-bold">Observed request outcomes</h3><SourceBadge>Request telemetry</SourceBadge></div><p className="text-[9.5px] text-slate-500 mt-1">Select a row for detail. These are recorded edge facts, not reconstructed provider-scoring decisions.</p></div><label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 h-8 bg-white"><Search size={12}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search model, reason, provider" className="outline-none text-[10px] w-[180px]"/></label><select value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)} className="h-8 border border-slate-200 rounded-lg bg-white px-2 text-[10px]"><option value="all">All request types</option>{requestTypes.map((type)=><option key={type} value={type}>{type}</option>)}</select><select value={outcomeFilter} onChange={(e)=>setOutcomeFilter(e.target.value as typeof outcomeFilter)} className="h-8 border border-slate-200 rounded-lg bg-white px-2 text-[10px]"><option value="all">All outcomes</option><option value="errors">Error-labelled only</option></select></div>
      <div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[900px] text-left text-[10px]"><thead className="bg-slate-50 text-slate-500 sticky top-0"><tr><th className="p-2">Time</th><th className="p-2">Request type</th><th className="p-2">Observed model</th><th className="p-2">Provider attribution</th><th className="p-2">Authority marker</th><th className="p-2">Latency</th><th className="p-2">Observed cost</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.slice(0,100).map((row,index)=><tr key={row.id??index} onClick={()=>setSelected(row)} className="cursor-pointer hover:bg-amber-50/40"><td className="p-2 font-mono">{row.timestamp ? formatDateTime(row.timestamp) : '—'}</td><td className="p-2">{row.requestType||'Unknown'}</td><td className="p-2">{row.selectedModel||'Unknown'}</td><td className="p-2">{row.providerId||'Unknown'}</td><td className="p-2 text-slate-500">{row.routingReason||'No reason recorded'}</td><td className="p-2 font-mono">{row.latency>0?formatLatency(row.latency):'—'}</td><td className="p-2 font-mono">{row.cost==null?'—':`$${row.cost.toFixed(6)}`}</td></tr>)}{!rows.length&&<tr><td colSpan={7} className="p-10 text-center text-slate-500">No observed requests available for this filter.</td></tr>}</tbody></table></div>
    </section> : null}

    <InspectorDrawer open={Boolean(selected)} onClose={()=>setSelected(null)} title="Observed routing outcome" subtitle={selected?.id ? <span className="font-mono">{selected.id}</span> : undefined}>
      {selected ? <div className="space-y-3"><DetailGrid><DetailItem label="Time" value={selected.timestamp?formatDateTime(selected.timestamp):'Unknown'}/><DetailItem label="Request type" value={selected.requestType||'Unknown'}/><DetailItem label="Selected model" value={selected.selectedModel||'Unknown'}/><DetailItem label="Provider attribution" value={selected.providerId||'Unknown'}/><DetailItem label="Latency" value={selected.latency>0?formatLatency(selected.latency):'Not observed'}/><DetailItem label="Observed cost" value={selected.cost==null?'Not observed':`$${selected.cost.toFixed(6)}`}/></DetailGrid><div className="rounded-xl border border-slate-200 p-3"><strong className="text-[10px]">Recorded authority marker / reason</strong><p className="mt-2 text-[9.5px] text-slate-500">{selected.routingReason||'No routing reason recorded.'}</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[9px] text-amber-800">This drawer does not claim to be a request-specific OmniRoute routing decision unless the source explicitly provides one.</div></div> : null}
    </InspectorDrawer>
  </div>;
};
