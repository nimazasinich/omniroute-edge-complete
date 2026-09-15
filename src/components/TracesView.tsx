import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Link2, Radio, RefreshCw, Route, Search, Server } from 'lucide-react';
import { formatDateTime, formatLatency } from '../utils/formatters';
import { SourcePill } from './WorkspacePrimitives';

interface TraceRow {
  id: string; requestId: string; timestamp: number | null; requestType: string | null; requestedModel: string | null; selectedModel: string | null;
  providerName: string | null; providerId: string | null; status: string | null; statusCode: number | null; latencyMs: number | null;
  correlationId: string | null; path: string | null; error: string | null; streaming: boolean | null;
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function optionalString(value: unknown): string | null { const text = typeof value === 'string' ? value.trim() : ''; return text ? text : null; }
function optionalNumber(value: unknown): number | null { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function envelopeItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const data = record.apiVersion === 'v2' && 'data' in record ? asRecord(record.data) : record;
  return Array.isArray(data.items) ? data.items : Array.isArray(value) ? value : [];
}
function normalizeTrace(value: unknown): TraceRow {
  const row = asRecord(value); const ts = optionalNumber(row.timestamp ?? row.observedAt);
  return { id: String(row.id ?? row.requestId ?? ''), requestId: String(row.requestId ?? row.id ?? ''), timestamp: ts !== null && ts > 0 ? ts : null, requestType: optionalString(row.requestType), requestedModel: optionalString(row.requestedModel), selectedModel: optionalString(row.selectedModel ?? row.modelName), providerName: optionalString(row.providerName), providerId: optionalString(row.providerId ?? row.selectedProviderId), status: optionalString(row.status), statusCode: optionalNumber(row.statusCode), latencyMs: optionalNumber(row.latencyMs ?? row.durationMs), correlationId: optionalString(row.correlationId), path: optionalString(row.path), error: optionalString(row.error), streaming: typeof row.streaming === 'boolean' ? row.streaming : null };
}

export const TracesView: React.FC = () => {
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchTraces = async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch('/api/v2/observability/requests?limit=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json(); const normalized = envelopeItems(data).map(normalizeTrace);
      setRows(normalized); setSelectedId((current) => current && normalized.some((row) => row.id === current) ? current : normalized[0]?.id ?? null);
    } catch (err) { setRows([]); setSelectedId(null); setLoadError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void fetchTraces(); }, []);

  const providers = useMemo(() => Array.from(new Set(rows.map((row)=>row.providerName||row.providerId).filter(Boolean) as string[])).sort(), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row)=>String(row.statusCode??row.status??'unknown')))).sort(), [rows]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = String(row.statusCode ?? row.status ?? 'unknown');
      const provider = row.providerName ?? row.providerId ?? '';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (providerFilter !== 'all' && provider !== providerFilter) return false;
      return !term || [row.requestId,row.correlationId,row.path,row.requestType,row.requestedModel,row.selectedModel,row.providerName,row.providerId,row.status,row.error].filter(Boolean).some((value)=>String(value).toLowerCase().includes(term));
    });
  }, [providerFilter, rows, search, statusFilter]);

  const selected = filtered.find((row) => row.id === selectedId) ?? filtered[0] ?? null;
  const correlatedRows = rows.filter((row) => row.correlationId).length;
  const attributedRows = rows.filter((row) => row.providerId || row.providerName).length;
  const errorRows = rows.filter((row) => row.error || row.status === 'error' || (row.statusCode !== null && row.statusCode >= 400)).length;

  return <div className="flex flex-col gap-3 h-full w-full select-none overflow-hidden pr-1">
    <div className="card-3d-glass p-3.5 flex items-center justify-between shrink-0 gap-3"><div><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-[#0051C3]/10 text-[#0051C3] flex items-center justify-center border border-[#0051C3]/20"><Radio size={14}/></div><h2 className="text-[14px] font-bold text-[#0F172A]">Edge Request Traces</h2><span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-[#475569] font-mono border border-slate-200">{rows.length} captured</span></div><p className="text-[10.5px] text-[#475569] mt-1">Data source: observed request lifecycle records and correlation evidence from the edge. OmniRoute owns provider selection and fallback; no candidate score trail is fabricated.</p></div><button onClick={()=>void fetchTraces()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCEBFA] bg-white text-[#0051C3] font-semibold text-[11px]"><RefreshCw size={12} className={loading?'animate-spin':''}/>Refresh</button></div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0"><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Observed traces</span><strong className="block text-[16px]">{rows.length}</strong><small className="text-[8.5px] text-slate-400">Data source: request lifecycle</small></div><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Correlation recorded</span><strong className="block text-[16px]">{rows.length?correlatedRows:'—'}</strong><small className="text-[8.5px] text-slate-400">Only persisted IDs</small></div><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Provider attribution</span><strong className="block text-[16px]">{rows.length?attributedRows:'—'}</strong><small className="text-[8.5px] text-slate-400">Authoritative rows only</small></div><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Error outcomes</span><strong className="block text-[16px]">{rows.length?errorRows:'—'}</strong><small className="text-[8.5px] text-slate-400">Recorded errors/status ≥ 400</small></div></div>

    {loadError?<div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">Trace API unavailable: {loadError}</div>:null}

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-1 min-h-0">
      <div className="xl:col-span-5 card-3d-glass p-3.5 flex flex-col min-h-0"><div className="flex flex-wrap gap-2 mb-2 shrink-0"><div className="relative flex-1 min-w-[180px]"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search trace..." className="w-full h-[30px] pl-7 pr-2 rounded-lg border border-[#DCEBFA] bg-white text-[11px] outline-none"/></div><select aria-label="Status filter" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="h-[30px] rounded-lg border border-slate-200 px-2 text-[9.5px]"><option value="all">Status filter: All</option>{statuses.map((status)=><option key={status}>{status}</option>)}</select><select aria-label="Provider filter" value={providerFilter} onChange={(e)=>setProviderFilter(e.target.value)} className="h-[30px] rounded-lg border border-slate-200 px-2 text-[9.5px]"><option value="all">Provider filter: All</option>{providers.map((provider)=><option key={provider}>{provider}</option>)}</select></div><div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#E2E8F0]/70 rounded-xl border border-[#E2E8F0] bg-white/70">{filtered.map((row)=><button key={row.id} onClick={()=>setSelectedId(row.id)} className={`w-full text-left p-2.5 ${selected?.id===row.id?'bg-blue-50/70':'hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-[#64748B]">{row.timestamp?formatDateTime(row.timestamp):'—'}</span><SourcePill label={String(row.statusCode??row.status??'unknown')} tone={row.statusCode!==null&&row.statusCode>=400?'rose':'slate'}/></div><div className="mt-1 flex items-center gap-2 min-w-0"><Route size={12} className="text-[#0051C3] shrink-0"/><span className="font-bold text-[12px] text-[#0F172A] truncate">{row.path??'Unknown path'}</span></div><div className="mt-1 flex items-center justify-between gap-2 text-[9.5px] text-[#64748B]"><span className="truncate font-mono">{row.requestedModel??'Model unknown'} · {formatLatency(row.latencyMs)}</span><SourcePill label={row.streaming===null?'Streaming unknown':row.streaming?'Streaming':'Non-streaming'} tone={row.streaming?'blue':'slate'}/></div></button>)}{!loading&&!filtered.length?<div className="p-8 text-center text-[12px] text-[#64748B]">No observed traces found.</div>:null}</div></div>

      <div className="xl:col-span-7 card-3d-glass p-3.5 flex flex-col min-h-0 overflow-auto">{selected?<><div className="pb-3 border-b border-[#E2E8F0]"><div className="flex items-center justify-between gap-3"><h3 className="text-[13px] font-bold text-[#0F172A]">Observed outcome</h3><span className="font-mono text-[10px] text-[#64748B] truncate">{selected.requestId||selected.id}</span></div><div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10.5px]"><div className="rounded-lg border border-[#E2E8F0] bg-white p-2"><span className="text-[#64748B]">HTTP / status</span><div className="font-bold">{selected.statusCode??selected.status??'Unknown'}</div></div><div className="rounded-lg border border-[#E2E8F0] bg-white p-2"><span className="text-[#64748B]">Latency</span><div className="font-bold font-mono">{formatLatency(selected.latencyMs)}</div></div><div className="rounded-lg border border-[#E2E8F0] bg-white p-2"><span className="text-[#64748B]">Streaming</span><div className="mt-1"><SourcePill label={selected.streaming===null?'Unknown':selected.streaming?'Streaming':'Non-streaming'} tone={selected.streaming?'blue':'slate'}/></div></div><div className="rounded-lg border border-[#E2E8F0] bg-white p-2"><span className="text-[#64748B]">Request type</span><div className="font-bold">{selected.requestType??'Unknown'}</div></div></div></div>

      <section className="mt-3 rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><Clock3 size={13} className="text-blue-600"/><h4 className="text-[11px] font-bold">Trace timeline</h4></div><div className="mt-3 border-l-2 border-blue-100 pl-3"><div className="relative pb-4"><span className="absolute -left-[17px] top-0 h-2 w-2 rounded-full bg-blue-500"/><div className="text-[9px] font-mono text-slate-400">0 ms</div><div className="text-[10px] font-bold">Edge request observed</div></div><div className="relative"><span className="absolute -left-[17px] top-0 h-2 w-2 rounded-full bg-emerald-500"/><div className="text-[9px] font-mono text-slate-400">{selected.latencyMs!=null?`${selected.latencyMs} ms`:'time unavailable'}</div><div className="text-[10px] font-bold">Edge outcome recorded</div></div></div><p className="mt-3 text-[9px] text-slate-500">Intermediate OmniRoute/provider attempt timestamps are omitted because they are not observed by this source.</p></section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"><section className="rounded-xl border border-[#E2E8F0] bg-white p-3"><h4 className="text-[11px] font-bold flex items-center gap-1.5"><Link2 size={13} className="text-[#0051C3]"/>Correlation ID</h4><div className="mt-2 font-mono text-[10px] text-[#475569] break-all">{selected.correlationId??'Not recorded'}</div></section><section className="rounded-xl border border-[#E2E8F0] bg-white p-3"><h4 className="text-[11px] font-bold flex items-center gap-1.5"><Route size={13} className="text-[#0051C3]"/>Request path</h4><div className="mt-2 font-mono text-[10px] text-[#475569] break-all">{selected.path??'Not recorded'}</div></section><section className="rounded-xl border border-[#E2E8F0] bg-white p-3"><h4 className="text-[11px] font-bold flex items-center gap-1.5"><Activity size={13} className="text-[#0051C3]"/>Model evidence</h4><div className="mt-2 text-[10px]">Requested: <b>{selected.requestedModel??'Unknown'}</b><br/>Selected: <b>{selected.selectedModel??'Unknown'}</b></div></section><section className="rounded-xl border border-[#E2E8F0] bg-white p-3"><h4 className="text-[11px] font-bold flex items-center gap-1.5"><Server size={13} className="text-[#0051C3]"/>Provider evidence</h4><div className="mt-2 text-[10px] text-[#475569]">{selected.providerName??selected.providerId??'Unknown — no authoritative provider attribution.'}</div></section></div><section className="mt-3 rounded-xl border border-[#E2E8F0] bg-slate-50/70 p-3"><h4 className="text-[11px] font-bold flex items-center gap-1.5"><Clock3 size={13} className="text-[#0051C3]"/>Error / completion detail</h4><p className="mt-2 text-[10.5px] text-[#475569] break-words">{selected.error??'No edge error recorded for this request.'}</p></section></>:<div className="flex-1 flex flex-col items-center justify-center text-center text-[#64748B]"><Radio size={30} className="mb-2 text-[#94A3B8]"/><h3 className="text-[14px] font-bold text-[#0F172A]">No trace data yet</h3></div>}</div>
    </div>
  </div>;
};
