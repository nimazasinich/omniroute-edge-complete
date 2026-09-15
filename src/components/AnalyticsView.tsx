import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart2, Clock, Cpu, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import type { AnalyticsData, DashboardData } from '../types';
import { formatBytes, formatCurrency, formatLatency, formatNumber } from '../utils/formatters';
import { DetailGrid, DetailItem, ModalDialog, ProgressBar, SourcePill, WorkspaceTabs } from './WorkspacePrimitives';

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function optionalNumber(value: unknown): number | null { if (value === null || value === undefined || value === '') return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function normalizeV2Metrics(value: unknown, hours: number): AnalyticsData {
  const record = asRecord(value);
  const data = asRecord(record.apiVersion === 'v2' ? record.data : value);
  const tokensIn = optionalNumber(data.tokensIn ?? data.observedTokensInput);
  const tokensOut = optionalNumber(data.tokensOut ?? data.observedTokensOutput);
  return {
    memoryUsage: null, memoryAllocated: null, cpuUsage: null, cpuTrend: null, requestsPerSec: null, requestsTrend: null,
    avgExecution: optionalNumber(data.averageDurationMs), executionTrend: null, windowHours: hours,
    totalRequests: Number(data.totalRequests ?? 0), avgLatencyMs: Number(data.averageDurationMs ?? 0),
    totalTokens: tokensIn === null && tokensOut === null ? null : (tokensIn ?? 0) + (tokensOut ?? 0),
    tokensIn, tokensOut, estimatedCost: optionalNumber(data.observedCost),
    byStatus: [
      { status: 'success', count: Number(data.successCount ?? 0) },
      { status: 'error', count: Number(data.errorCount ?? 0) },
      { status: 'blocked', count: Number(data.blockedCount ?? 0) },
    ].filter((row) => row.count > 0),
    byRequestType: [], byProvider: [], securityBySeverity: [], requestVolumeSeries: [],
  };
}

function buildSeriesPath(points: Array<{ timestamp: number; count: number }>, width: number, height: number): { line: string; area: string } | null {
  if (!points.length) return null;
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const denominator = Math.max(1, points.length - 1);
  const coords = points.map((point, index) => ({ x: (index / denominator) * width, y: height - (point.count / maxCount) * (height - 16) - 8 }));
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return { line, area: `${line} L ${width} ${height} L 0 ${height} Z` };
}

export const AnalyticsView: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [tab, setTab] = useState('Traffic');
  const [windowHours, setWindowHours] = useState(data.analytics?.windowHours ?? 24);
  const [viewData, setViewData] = useState<AnalyticsData | null>(data.analytics);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  useEffect(() => { setViewData(data.analytics); if (data.analytics?.windowHours) setWindowHours(data.analytics.windowHours); }, [data.analytics]);
  const refreshWindow = async (hours = windowHours) => {
    setRefreshing(true); setLoadError(null);
    try {
      const response = await fetch(`/api/v2/observability/metrics?hours=${hours}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setViewData(normalizeV2Metrics(await response.json(), hours));
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Analytics request failed'); }
    finally { setRefreshing(false); }
  };
  const changeWindow = (hours: number) => { setWindowHours(hours); void refreshWindow(hours); };

  const analytics = viewData;
  const providerBuckets = analytics?.byProvider ?? [];
  const attributedProviders = providerBuckets.filter((p)=>p.count>0&&p.providerId);
  const totalProviderRequests = attributedProviders.reduce((sum, provider) => sum + provider.count, 0);
  const series = analytics?.requestVolumeSeries ?? [];
  const path = useMemo(() => buildSeriesPath(series, 500, 160), [series]);
  const runtimeMemoryGb = data.runtime?.available && data.runtime.heapUsedMb !== null ? data.runtime.heapUsedMb / 1024 : analytics?.memoryUsage ?? null;
  const memoryAllocated = data.runtime?.available && data.runtime.heapTotalMb !== null ? data.runtime.heapTotalMb / 1024 : analytics?.memoryAllocated ?? null;
  const memoryPercent = runtimeMemoryGb !== null && memoryAllocated !== null && memoryAllocated > 0 ? Math.round((runtimeMemoryGb / memoryAllocated) * 100) : null;
  const maxStatus = Math.max(1, ...(analytics?.byStatus ?? []).map((row)=>row.count));
  const maxSeverity = Math.max(1, ...(analytics?.securityBySeverity ?? []).map((row)=>row.count));

  return <div className="flex flex-col gap-3 h-full w-full select-none overflow-y-auto pr-1">
    <div className="card-3d-glass p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0"><div><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-[#0051C3]/10 text-[#0051C3] flex items-center justify-center border border-[#0051C3]/20"><Activity size={14}/></div><h2 className="text-[14px] font-bold text-[#0F172A]">Platform Telemetry & Analytics</h2></div><p className="text-[10.5px] text-[#475569] mt-1">Data source: edge-observed request telemetry and local runtime samples. Tokens/cost remain unknown until recorded.</p></div><div className="flex items-center gap-2"><select value={windowHours} onChange={(e)=>changeWindow(Number(e.target.value))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px]"><option value={1}>Last hour</option><option value={24}>Last 24 hours</option><option value={72}>Last 3 days</option><option value={168}>Last 7 days</option><option value={720}>Last 30 days</option></select><button onClick={()=>void refreshWindow()} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-blue-700"><RefreshCw size={11} className={refreshing?'animate-spin':''}/>Refresh</button></div></div>
    {loadError?<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800">Analytics refresh unavailable: {loadError}. Showing the most recent available dataset.</div>:null}

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0"><Metric icon={TrendingUp} tone="#0051C3" label="Observed requests" value={analytics?formatNumber(analytics.totalRequests??0):'—'} note="D1 observed"/><Metric icon={Clock} tone="#8B5CF6" label="Avg Latency" value={analytics?formatLatency(analytics.avgLatencyMs??data.stats?.avgLatency??null):'—'} note="edge observed"/><Metric icon={DollarSign} tone="#10B981" label="Observed Cost" value={formatCurrency(analytics?.estimatedCost??null)} note={analytics?.estimatedCost==null?'upstream usage not integrated':'authoritative observed field'}/><Metric icon={Cpu} tone="#F59E0B" label="Runtime Memory" value={formatBytes(runtimeMemoryGb)} note={data.runtime?.available?'Node runtime sample':'runtime sample unavailable'}/></div>

    <section className="card-3d-glass p-3"><WorkspaceTabs tabs={[{id:'Traffic',label:'Traffic'},{id:'Providers',label:'Providers',count:attributedProviders.length},{id:'Usage',label:'Usage'},{id:'Reliability',label:'Reliability'},{id:'Regions',label:'Regions'}]} active={tab} onChange={setTab}/></section>

    {tab==='Traffic'?<section className="card-3d-glass p-4 min-h-[340px] flex flex-col"><div className="flex items-center justify-between mb-2"><div><h3 className="text-[13px] font-bold">Inference Traffic Over Time</h3><span className="text-[10px] text-slate-500">Request buckets from the real request log.</span></div><button onClick={()=>setChartOpen(true)} className="flex items-center gap-1 text-[10px] text-blue-700 font-semibold"><BarChart2 size={12}/>Expand chart</button></div><div className="relative flex-1 min-h-[220px] rounded-xl border border-slate-200 bg-white/60 flex items-center justify-center overflow-hidden">{path?<svg className="w-full h-full min-h-[220px]" viewBox="0 0 500 160" preserveAspectRatio="none"><defs><linearGradient id="reqGradDeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0051C3" stopOpacity=".25"/><stop offset="1" stopColor="#0051C3" stopOpacity="0"/></linearGradient></defs><path d={path.area} fill="url(#reqGradDeep)"/><path d={path.line} fill="none" stroke="#0051C3" strokeWidth="2.5"/></svg>:<div className="text-center text-[11px] text-slate-500"><strong className="block text-slate-800">No observed analytics data</strong><span>The chart appears after real gateway traffic is recorded.</span></div>}</div><div className="flex justify-between text-[9px] text-slate-500 font-mono mt-2"><span>{series[0]?new Date(series[0].timestamp).toLocaleString():'No data'}</span><span>{series.length} buckets</span><span>{series.at(-1)?new Date(series.at(-1)!.timestamp).toLocaleString():'—'}</span></div></section>:null}

    {tab==='Providers'?<section className="card-3d-glass p-4"><div className="flex items-center justify-between"><div><h3 className="text-[13px] font-bold">Provider Attribution</h3><span className="text-[10px] text-slate-500">Only requests with an authoritative provider ID are attributed.</span></div><SourcePill label="OBSERVED" tone="blue"/></div><div className="mt-4 grid gap-3">{attributedProviders.map((provider)=>{const share=totalProviderRequests?Math.round((provider.count/totalProviderRequests)*1000)/10:0;return <div key={provider.providerId??provider.providerName} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between text-[10px] font-semibold"><span>{provider.providerName}</span><span className="font-mono text-slate-500">{share}%</span></div><div className="mt-2"><ProgressBar value={share}/></div><div className="mt-2 flex justify-between text-[9px] text-slate-500 font-mono"><span>{provider.count} req</span><span>{formatLatency(provider.avgLatencyMs)}</span><span>{provider.cost==null?'cost —':formatCurrency(provider.cost)}</span></div></div>})}{!attributedProviders.length?<div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-[10px] text-slate-500">No authoritative provider attribution is present.</div>:null}</div></section>:null}

    {tab==='Usage'?<section className="grid grid-cols-1 md:grid-cols-2 gap-3"><div className="card-3d-glass p-4"><h3 className="text-[12px] font-bold">Token usage</h3><div className="mt-3"><DetailGrid><DetailItem label="Prompt Tokens" value={analytics?.tokensIn==null?'Not observed':formatNumber(analytics.tokensIn)}/><DetailItem label="Completion Tokens" value={analytics?.tokensOut==null?'Not observed':formatNumber(analytics.tokensOut)}/><DetailItem label="Total Tokens" value={analytics?.totalTokens==null?'Not observed':formatNumber(analytics.totalTokens)}/><DetailItem label="Observed cost" value={formatCurrency(analytics?.estimatedCost??null)}/></DetailGrid></div></div><div className="card-3d-glass p-4"><h3 className="text-[12px] font-bold">Runtime memory</h3><div className="mt-3"><DetailGrid><DetailItem label="Used" value={formatBytes(runtimeMemoryGb)}/><DetailItem label="Allocated" value={formatBytes(memoryAllocated)}/><DetailItem label="Memory Pressure" value={memoryPercent===null?'Unknown':`${memoryPercent}%`}/><DetailItem label="Source" value={data.runtime?.available?'Node runtime sample':'Unavailable'}/></DetailGrid></div></div></section>:null}

    {tab==='Reliability'?<section className="grid grid-cols-1 lg:grid-cols-2 gap-3"><div className="card-3d-glass p-4"><h3 className="text-[12px] font-bold">Request status breakdown</h3><div className="mt-4 grid gap-3">{(analytics?.byStatus??[]).map((row)=><div key={row.status}><div className="mb-1 flex justify-between text-[9.5px]"><span>{row.status}</span><span className="font-mono">{row.count}</span></div><ProgressBar value={row.count} max={maxStatus}/></div>)}{!(analytics?.byStatus?.length)?<p className="text-[9.5px] text-slate-500">No observed status breakdown.</p>:null}</div></div><div className="card-3d-glass p-4"><h3 className="text-[12px] font-bold">Security severity observations</h3><div className="mt-4 grid gap-3">{(analytics?.securityBySeverity??[]).map((row)=><div key={row.severity}><div className="mb-1 flex justify-between text-[9.5px]"><span>{row.severity}</span><span className="font-mono">{row.count}</span></div><ProgressBar value={row.count} max={maxSeverity}/></div>)}{!(analytics?.securityBySeverity?.length)?<p className="text-[9.5px] text-slate-500">No observed security severity breakdown.</p>:null}</div></div></section>:null}

    {tab==='Regions'?<section className="card-3d-glass p-8 text-center text-[10px] text-slate-500"><strong className="block text-[12px] text-slate-800">Regional analytics unavailable in the current dataset.</strong><p className="mt-2">Cloudflare colo/region observations will appear only after the deployed edge records them. Localhost geography is not substituted.</p></section>:null}

    <ModalDialog open={chartOpen} onClose={()=>setChartOpen(false)} title="Traffic chart detail" description={`Observed request buckets for the selected ${windowHours}-hour window.`} size="xl"><div className="min-h-[420px] rounded-xl border border-slate-200 bg-white p-3">{path?<svg className="h-[400px] w-full" viewBox="0 0 500 160" preserveAspectRatio="none"><path d={path.area} fill="#dbeafe"/><path d={path.line} fill="none" stroke="#0051C3" strokeWidth="2"/></svg>:<div className="grid h-[400px] place-items-center text-[10px] text-slate-500">No observed request series.</div>}</div></ModalDialog>
  </div>;
};

const Metric = ({icon:Icon,tone,label,value,note}:{icon:React.ComponentType<{size?:number}>;tone:string;label:string;value:string;note:string}) => <div className="card-3d-glass p-3"><div style={{color:tone}}><Icon size={14}/></div><span className="block mt-2 text-[10px] text-slate-500">{label}</span><strong className="block text-[18px] font-mono text-slate-900">{value}</strong><small className="text-[9px] text-slate-400">{note}</small></div>;
