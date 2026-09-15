import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw, Search } from 'lucide-react';
import { formatCurrency, formatDateTime, formatLatency, formatNumber } from '../utils/formatters';
import { DetailGrid, DetailItem, InspectorDrawer, SourcePill } from './WorkspacePrimitives';

type LogStatus = 'success' | 'blocked' | 'error' | 'unknown';
type DateRange = 'all' | '1h' | '24h' | '7d';
type SortKey = 'time' | 'latency' | 'cost';

interface LogItem {
  id: string;
  timestamp: number | null;
  clientName: string | null;
  requestType: string | null;
  requestedModel: string | null;
  selectedModel: string | null;
  providerName: string | null;
  path: string | null;
  correlationId: string | null;
  error: string | null;
  latencyMs: number | null;
  observedTokensInput: number | null;
  observedTokensOutput: number | null;
  observedCost: number | null;
  status: LogStatus;
  statusCode: number | null;
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function optionalString(value: unknown): string | null { const text = typeof value === 'string' ? value.trim() : ''; return text ? text : null; }
function optionalNumber(value: unknown): number | null { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function envelopeItems(value: unknown): unknown[] {
  const record = asRecord(value);
  const data = record.apiVersion === 'v2' && 'data' in record ? asRecord(record.data) : record;
  return Array.isArray(data.items) ? data.items : Array.isArray(value) ? value : [];
}
function normalizeStatus(value: unknown): LogStatus { const status = String(value ?? '').toLowerCase(); return status === 'success' || status === 'blocked' || status === 'error' ? status : 'unknown'; }
function normalizeLogItem(value: unknown): LogItem {
  const row = asRecord(value); const timestamp = optionalNumber(row.timestamp ?? row.observedAt);
  return { id: String(row.id ?? row.requestId ?? ''), timestamp: timestamp !== null && timestamp > 0 ? timestamp : null, clientName: optionalString(row.clientName ?? row.clientId), requestType: optionalString(row.requestType), requestedModel: optionalString(row.requestedModel), selectedModel: optionalString(row.selectedModel), providerName: optionalString(row.providerName ?? row.providerId), path: optionalString(row.path), correlationId: optionalString(row.correlationId), error: optionalString(row.error), latencyMs: optionalNumber(row.latencyMs ?? row.durationMs), observedTokensInput: optionalNumber(row.observedTokensInput ?? row.tokensInput), observedTokensOutput: optionalNumber(row.observedTokensOutput ?? row.tokensOutput), observedCost: optionalNumber(row.observedCost ?? row.cost), status: normalizeStatus(row.status), statusCode: optionalNumber(row.statusCode) };
}
function tokenTotal(log: LogItem): number | null { if (log.observedTokensInput === null && log.observedTokensOutput === null) return null; return (log.observedTokensInput ?? 0) + (log.observedTokensOutput ?? 0); }
function rangeMs(range: DateRange): number | null { return range === '1h' ? 3600_000 : range === '24h' ? 86_400_000 : range === '7d' ? 604_800_000 : null; }

export const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LogStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selected, setSelected] = useState<LogItem | null>(null);

  const fetchLogs = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/v2/observability/requests?limit=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const items = envelopeItems(payload);
      setLogs(items.map(normalizeLogItem));
    } catch (err) { setLogs([]); setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchLogs(); }, []);
  useEffect(() => { if (!autoRefresh) return; const id = window.setInterval(() => void fetchLogs(), 10_000); return () => window.clearInterval(id); }, [autoRefresh]);

  const filteredLogs = useMemo(() => {
    const cutoff = rangeMs(dateRange);
    const latestObservedAt = logs.reduce((latest, log) => Math.max(latest, log.timestamp ?? 0), 0);
    const filtered = logs.filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (cutoff !== null && (log.timestamp === null || latestObservedAt === 0 || latestObservedAt - log.timestamp > cutoff)) return false;
      const term = searchTerm.trim().toLowerCase();
      return !term || [log.id, log.clientName, log.requestType, log.requestedModel, log.selectedModel, log.providerName, log.path, log.correlationId, log.error].filter(Boolean).some((entry) => String(entry).toLowerCase().includes(term));
    });
    return [...filtered].sort((a,b) => sortKey === 'latency' ? (b.latencyMs ?? -1) - (a.latencyMs ?? -1) : sortKey === 'cost' ? (b.observedCost ?? -1) - (a.observedCost ?? -1) : (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }, [dateRange, logs, searchTerm, sortKey, statusFilter]);

  useEffect(() => { setPage(1); }, [dateRange, searchTerm, sortKey, statusFilter, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const visibleLogs = filteredLogs.slice((Math.min(page,pageCount)-1)*pageSize, Math.min(page,pageCount)*pageSize);
  const observedTokenRows = logs.filter((log) => tokenTotal(log) !== null).length;
  const observedCostRows = logs.filter((log) => log.observedCost !== null).length;

  const exportVisible = () => {
    const columns = ['time','status','path','model','provider','correlation','tokens','latencyMs','cost'];
    const rows = visibleLogs.map((log) => [log.timestamp ? new Date(log.timestamp).toISOString() : '', log.statusCode ?? log.status, log.path ?? '', log.selectedModel ?? log.requestedModel ?? '', log.providerName ?? '', log.correlationId ?? '', tokenTotal(log) ?? '', log.latencyMs ?? '', log.observedCost ?? '']);
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'omniroute-visible-logs.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="flex flex-col gap-3 h-full w-full select-none overflow-y-auto pr-1">
    <div className="card-3d-glass p-3.5 flex items-center justify-between gap-3 shrink-0"><div><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-[#0051C3]/10 text-[#0051C3] flex items-center justify-center border border-[#0051C3]/20"><FileText size={14}/></div><h2 className="text-[14px] font-bold text-[#0F172A]">Edge Request Logs</h2><span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-[#475569] font-mono border border-slate-200">{logs.length} loaded</span></div><p className="text-[10.5px] text-[#475569] mt-1">Data source: D1 edge-observed request lifecycle facts. Unknown upstream fields remain unknown.</p></div><button onClick={()=>void fetchLogs()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCEBFA] bg-white text-[#0051C3] font-semibold text-[11px]"><RefreshCw size={12} className={loading?'animate-spin':''}/>Refresh</button></div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">{[['Observed requests', logs.length?formatNumber(logs.length):'—'],['Observed tokens', observedTokenRows?`${observedTokenRows} rows`:'No observed token usage'],['Observed cost', observedCostRows?`${observedCostRows} rows`:'No observed cost'],['Source','D1 edge telemetry']].map(([label,value])=><div key={label} className="card-3d-glass p-3"><div className="text-[9.5px] uppercase tracking-wide text-[#64748B] font-semibold">{label}</div><div className="mt-1 text-[12px] font-bold text-[#0F172A]">{value}</div></div>)}</div>

    <div className="card-3d-glass p-2.5 flex flex-wrap items-center gap-2 shrink-0">
      <div className="relative flex-1 min-w-[220px] max-w-[420px]"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12}/><input value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} placeholder="Search request, model, path, correlation ID..." className="w-full h-[30px] pl-7 pr-2 rounded-lg border border-[#DCEBFA] bg-white text-[11px] outline-none"/></div>
      <select aria-label="Request status" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as 'all'|LogStatus)} className="h-[30px] border border-[#DCEBFA] rounded-lg px-2 text-[10px]"><option value="all">All outcomes</option><option value="success">Success</option><option value="blocked">Blocked</option><option value="error">Error</option><option value="unknown">Unknown</option></select>
      <select aria-label="Date range" value={dateRange} onChange={(e)=>setDateRange(e.target.value as DateRange)} className="h-[30px] border border-[#DCEBFA] rounded-lg px-2 text-[10px]"><option value="all">Date range: loaded data</option><option value="1h">Last 1 hour</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select>
      <select value={sortKey} onChange={(e)=>setSortKey(e.target.value as SortKey)} className="h-[30px] border border-[#DCEBFA] rounded-lg px-2 text-[10px]"><option value="time">Sort: newest</option><option value="latency">Sort: latency</option><option value="cost">Sort: cost</option></select>
      <label className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[9.5px]"><input type="checkbox" checked={autoRefresh} onChange={(e)=>setAutoRefresh(e.target.checked)}/>Auto refresh</label>
      <button onClick={exportVisible} disabled={!visibleLogs.length} className="inline-flex h-[30px] items-center gap-1 rounded-lg border border-slate-200 px-2 text-[9.5px] font-bold text-blue-700 disabled:opacity-40"><Download size={11}/>Export visible</button>
    </div>

    <div className="card-3d-glass p-3.5 flex flex-col flex-1 min-h-[350px]">{error?<div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">Logs unavailable: {error}</div>:null}<div className="flex-1 overflow-auto"><table className="w-full text-left text-[10.5px] min-w-[980px]"><thead className="text-[#64748B] border-b border-[#E2E8F0] bg-slate-50/50 sticky top-0"><tr><th className="py-2 pl-2">Time</th><th className="py-2">Outcome</th><th className="py-2">Path</th><th className="py-2">Observed model</th><th className="py-2">Provider attribution</th><th className="py-2">Correlation</th><th className="py-2 text-right">Observed tokens</th><th className="py-2 text-right">Latency</th><th className="py-2 text-right pr-2">Observed cost</th></tr></thead><tbody className="divide-y divide-[#E2E8F0]/70">{visibleLogs.map((log)=>{const totalTokens=tokenTotal(log);return <tr key={log.id} onClick={()=>setSelected(log)} className="cursor-pointer hover:bg-blue-50/40"><td className="py-2.5 pl-2 font-mono text-[10px] text-[#64748B] whitespace-nowrap">{log.timestamp?formatDateTime(log.timestamp):'—'}</td><td className="py-2.5"><SourcePill label={String(log.statusCode??log.status)} tone={log.status==='success'?'green':log.status==='error'?'rose':log.status==='blocked'?'amber':'slate'}/></td><td className="py-2.5 font-mono text-[10px]">{log.path??'—'}</td><td className="py-2.5 font-semibold">{log.selectedModel??log.requestedModel??'Unknown'}</td><td className="py-2.5 text-[#475569]">{log.providerName??'Unknown'}</td><td className="py-2.5 font-mono text-[9.5px] text-[#64748B] max-w-[150px] truncate">{log.correlationId??'—'}</td><td className="py-2.5 text-right font-mono text-[#64748B]">{totalTokens===null?'—':formatNumber(totalTokens)}</td><td className="py-2.5 text-right font-mono font-semibold">{formatLatency(log.latencyMs)}</td><td className="py-2.5 text-right pr-2 font-mono text-[#64748B]">{formatCurrency(log.observedCost)}</td></tr>})}{!loading&&!visibleLogs.length?<tr><td colSpan={9} className="py-10 text-center text-[#64748B]">No observed request logs match the current filter.</td></tr>:null}</tbody></table></div><div className="mt-3 flex items-center justify-between text-[9.5px] text-slate-500"><div className="flex items-center gap-2"><span>Showing {visibleLogs.length} of {filteredLogs.length}</span><label>Page size <select value={pageSize} onChange={(e)=>setPageSize(Number(e.target.value))} className="ml-1 rounded border border-slate-200 px-1 py-0.5"><option>25</option><option>50</option><option>100</option></select></label></div><div className="flex items-center gap-2"><button disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1,p-1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Previous</button><span className="font-mono">{Math.min(page,pageCount)} / {pageCount}</span><button disabled={page>=pageCount} onClick={()=>setPage((p)=>Math.min(pageCount,p+1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Next</button></div></div></div>

    <InspectorDrawer open={Boolean(selected)} onClose={()=>setSelected(null)} title="Request detail" subtitle={selected?.id ? <span className="font-mono">{selected.id}</span> : undefined}>
      {selected?<div className="space-y-3"><DetailGrid><DetailItem label="Time" value={selected.timestamp?formatDateTime(selected.timestamp):'Unknown'}/><DetailItem label="Outcome" value={selected.statusCode??selected.status}/><DetailItem label="Path" value={selected.path??'Not observed'} mono/><DetailItem label="Correlation ID" value={selected.correlationId??'Not observed'} mono/><DetailItem label="Requested model" value={selected.requestedModel??'Unknown'}/><DetailItem label="Selected model" value={selected.selectedModel??'Unknown'}/><DetailItem label="Provider" value={selected.providerName??'Unknown'}/><DetailItem label="Latency" value={formatLatency(selected.latencyMs)}/><DetailItem label="Input tokens" value={selected.observedTokensInput??'Not observed'}/><DetailItem label="Output tokens" value={selected.observedTokensOutput??'Not observed'}/><DetailItem label="Observed cost" value={formatCurrency(selected.observedCost)}/><DetailItem label="Request type" value={selected.requestType??'Unknown'}/></DetailGrid><div className="rounded-xl border border-slate-200 p-3"><strong className="text-[10px]">Error detail</strong><p className="mt-2 text-[9.5px] text-slate-500">{selected.error??'No edge error recorded.'}</p></div></div>:null}
    </InspectorDrawer>
  </div>;
};
