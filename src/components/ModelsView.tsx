import React, { useMemo, useState } from 'react';
import { CheckSquare, Cpu, Database, GitCompareArrows, Search, ServerCog, Square } from 'lucide-react';
import type { DashboardData, Model } from '../types';
import { MetricTile, PageHeader, SourceBadge } from './PagePrimitives';
import { DetailGrid, DetailItem, InspectorDrawer, ModalDialog, ProgressBar, SourcePill, WorkspaceTabs } from './WorkspacePrimitives';
import { formatNumber } from '../utils/formatters';

const modelCaps = (model: Model) => Array.isArray(model.capabilities) ? model.capabilities : typeof model.capabilities === 'string' ? [model.capabilities] : [];
const modelEnabled = (model: Model) => model.active !== false && model.enabled !== false;
const modelPromptCost = (model: Model) => model.costPer1kPrompt ?? model.inputCost;
const modelCompletionCost = (model: Model) => model.costPer1kCompletion ?? model.outputCost;
const price = (value: number | undefined) => value == null ? '—' : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })} / 1k`;

export const Models: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [capabilityFilter, setCapabilityFilter] = useState('all');
  const [selected, setSelected] = useState<Model | null>(null);
  const [detailTab, setDetailTab] = useState('Overview');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const providerNames = useMemo(() => new Map(data.providers.map((provider) => [provider.id, provider.name])), [data.providers]);
  const capabilities = useMemo(() => Array.from(new Set(data.models.flatMap(modelCaps))).sort(), [data.models]);
  const rows = useMemo(() => data.models.filter((model) => {
    const term = query.trim().toLowerCase();
    if (providerFilter !== 'all' && model.providerId !== providerFilter) return false;
    const caps = modelCaps(model);
    if (capabilityFilter !== 'all' && !caps.includes(capabilityFilter)) return false;
    return !term || [model.name, model.modelName, model.id, providerNames.get(model.providerId), caps.join(' ')].some((value) => String(value ?? '').toLowerCase().includes(term));
  }), [capabilityFilter, data.models, providerFilter, providerNames, query]);

  const enabled = data.models.filter(modelEnabled).length;
  const withContext = data.models.filter((m) => m.contextWindow != null).length;
  const withCost = data.models.filter((m) => modelPromptCost(m) != null || modelCompletionCost(m) != null).length;
  const maxContext = Math.max(1, ...data.models.map((model) => model.contextWindow ?? 0));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const compareModels = compareIds.map((id) => data.models.find((model) => model.id === id)).filter(Boolean) as Model[];

  const resetPage = () => setPage(1);
  const toggleCompare = (id: string) => setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current);
  const openModel = (model: Model) => { setSelected(model); setDetailTab('Overview'); };

  return <div className="flex flex-col gap-3 h-full w-full overflow-y-auto pr-1">
    <PageHeader icon={Cpu} tone="violet" title="Model inventory" badge="Read-only" description="Complete model snapshot plus the real OmniRoute `/v1/models` connectivity probe. Inventory metadata is not treated as live model readiness." actions={compareIds.length ? <button onClick={() => setCompareOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[10px] font-bold text-white"><GitCompareArrows size={12}/>Compare models ({compareIds.length})</button> : undefined}/>

    <section className="grid grid-cols-2 xl:grid-cols-5 gap-2.5">
      <MetricTile label="Model records" value={formatNumber(data.models.length)} note="Data source: inventory read model" />
      <MetricTile label="Enabled snapshot" value={formatNumber(enabled)} note="Configuration metadata only" />
      <MetricTile label="Context metadata" value={formatNumber(withContext)} note="Models with recorded context window" />
      <MetricTile label="Cost metadata" value={formatNumber(withCost)} note="Pricing shown only when source includes it" />
      <MetricTile label="OmniRoute model surface" value={data.omniRouteStatus?.modelCount ?? '—'} note={data.omniRouteStatus?.reachable === true ? 'Authoritative /v1/models response' : 'Live origin unavailable'} />
    </section>

    {data.omniRouteStatus?.modelIds?.length ? <section className="card-3d-glass p-3"><div className="flex items-center gap-2 mb-2"><ServerCog size={14} className="text-emerald-600"/><h3 className="text-[11px] font-bold">Live OmniRoute model IDs</h3><SourceBadge>Configured OmniRoute</SourceBadge></div><div className="flex max-h-20 flex-wrap gap-1.5 overflow-auto">{data.omniRouteStatus.modelIds.map((id)=><span key={id} className="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-[9px] font-mono text-emerald-800">{id}</span>)}</div></section> : null}

    <section className="card-3d-glass p-4 flex-1 min-h-[380px]">
      <div className="flex flex-wrap items-center gap-2 mb-3"><div className="mr-auto"><div className="flex items-center gap-2"><h3 className="text-[12px] font-bold">Snapshot model registry</h3><SourceBadge>Inventory metadata</SourceBadge></div><p className="text-[9.5px] text-slate-500 mt-1">Select a model for the Model inspector or select up to five rows for comparison. All {data.models.length} records remain reachable through paging.</p></div><label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 h-8 bg-white"><Search size={12}/><input aria-label="Search models" value={query} onChange={(e)=>{setQuery(e.target.value);resetPage();}} placeholder="Search models" className="outline-none text-[10px] w-[150px]"/></label><select aria-label="Provider filter" value={providerFilter} onChange={(e)=>{setProviderFilter(e.target.value);resetPage();}} className="h-8 border border-slate-200 rounded-lg bg-white px-2 text-[10px]"><option value="all">Provider filter: All</option>{data.providers.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label="Capability filter" value={capabilityFilter} onChange={(e)=>{setCapabilityFilter(e.target.value);resetPage();}} className="h-8 border border-slate-200 rounded-lg bg-white px-2 text-[10px]"><option value="all">All capabilities</option>{capabilities.map((cap)=><option key={cap} value={cap}>{cap}</option>)}</select></div>
      <div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[1080px] text-left text-[10px]"><thead className="bg-slate-50 text-slate-500 sticky top-0"><tr><th className="p-2 w-8">Compare</th><th className="p-2">Model</th><th className="p-2">Provider</th><th className="p-2">Context window</th><th className="p-2">State</th><th className="p-2">Capabilities</th><th className="p-2">Prompt cost</th><th className="p-2">Completion cost</th><th className="p-2">Data source</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((model)=>{const promptCost=modelPromptCost(model);const completionCost=modelCompletionCost(model);const caps=modelCaps(model);const checked=compareIds.includes(model.id);return <tr key={model.id} className="hover:bg-violet-50/30"><td className="p-2"><button aria-label={`Compare ${model.name || model.id}`} onClick={()=>toggleCompare(model.id)} className="text-violet-600 disabled:opacity-30" disabled={!checked&&compareIds.length>=5}>{checked?<CheckSquare size={14}/>:<Square size={14}/>}</button></td><td className="p-2 cursor-pointer" onClick={()=>openModel(model)}><div className="font-semibold text-slate-900">{model.name||model.modelName||model.id}</div><div className="text-[8.7px] text-slate-400 font-mono">{model.id}</div></td><td className="p-2">{providerNames.get(model.providerId)||model.providerId||'Unknown'}</td><td className="p-2"><div className="flex items-center gap-2"><ProgressBar value={model.contextWindow ?? null} max={maxContext}/><span className="font-mono">{model.contextWindow?model.contextWindow.toLocaleString():'—'}</span></div></td><td className="p-2"><SourcePill label={modelEnabled(model)?'Enabled snapshot':'Disabled snapshot'} tone={modelEnabled(model)?'blue':'slate'}/></td><td className="p-2"><div className="flex max-w-[230px] flex-wrap gap-1">{caps.length?caps.slice(0,4).map((cap)=><span key={cap} className="rounded-md border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[8px] font-bold text-violet-700">{cap}</span>):<span className="text-slate-400">—</span>}{caps.length>4?<span className="text-[8px] text-slate-400">+{caps.length-4}</span>:null}</div></td><td className="p-2 font-mono">{price(promptCost)}</td><td className="p-2 font-mono">{price(completionCost)}</td><td className="p-2"><span className="inline-flex items-center gap-1 text-[8.8px] text-slate-500"><Database size={10}/>snapshot</span></td></tr>})}{!visibleRows.length&&<tr><td colSpan={9} className="p-10 text-center text-slate-500">No model records match this filter.</td></tr>}</tbody></table></div>
      <div className="mt-3 flex items-center justify-between text-[9.5px] text-slate-500"><span>Showing {visibleRows.length} of {rows.length} matching models · Page size {pageSize}</span><div className="flex items-center gap-2"><button disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1,p-1))} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40">Previous</button><span className="font-mono">{Math.min(page,pageCount)} / {pageCount}</span><button disabled={page>=pageCount} onClick={()=>setPage((p)=>Math.min(pageCount,p+1))} className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40">Next</button></div></div>
    </section>

    <InspectorDrawer open={Boolean(selected)} onClose={()=>setSelected(null)} title="Model inspector" subtitle={selected ? <span className="font-mono">{selected.id}</span> : undefined}>
      {selected ? <div className="space-y-3"><WorkspaceTabs tabs={[{id:'Overview',label:'Overview'},{id:'Capabilities',label:'Capabilities',count:modelCaps(selected).length},{id:'Pricing',label:'Pricing'}]} active={detailTab} onChange={setDetailTab}/>{detailTab==='Overview'?<DetailGrid><DetailItem label="Model" value={selected.name||selected.id}/><DetailItem label="Provider" value={providerNames.get(selected.providerId)||selected.providerId||'Unknown'}/><DetailItem label="Context window" value={selected.contextWindow?.toLocaleString()??'Unknown'}/><DetailItem label="State" value={modelEnabled(selected)?'Enabled snapshot':'Disabled snapshot'}/></DetailGrid>:null}{detailTab==='Capabilities'?<div><h3 className="text-[10px] font-bold text-slate-700">Capabilities</h3><div className="mt-2 flex flex-wrap gap-1.5">{modelCaps(selected).map((cap)=><React.Fragment key={cap}><SourcePill label={cap} tone="blue"/></React.Fragment>)}{!modelCaps(selected).length?<p className="text-[9.5px] text-slate-500">No capability metadata recorded.</p>:null}</div></div>:null}{detailTab==='Pricing'?<DetailGrid><DetailItem label="Prompt pricing" value={price(modelPromptCost(selected))}/><DetailItem label="Completion pricing" value={price(modelCompletionCost(selected))}/></DetailGrid>:null}<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[9px] text-slate-500">Model readiness and live provider availability are not inferred from this snapshot record.</div></div>:null}
    </InspectorDrawer>

    <ModalDialog open={compareOpen} onClose={()=>setCompareOpen(false)} title="Compare models" description="Comparison uses recorded model metadata only. Missing fields remain unavailable." size="xl">
      <div className="overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-[10px]"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Field</th>{compareModels.map((model)=><th key={model.id} className="p-2 text-left">{model.name||model.id}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{[
        ['Provider',(m:Model)=>providerNames.get(m.providerId)||m.providerId||'Unknown'],
        ['Context window',(m:Model)=>m.contextWindow?.toLocaleString()??'—'],
        ['State',(m:Model)=>modelEnabled(m)?'Enabled snapshot':'Disabled snapshot'],
        ['Capabilities',(m:Model)=>modelCaps(m).join(', ')||'—'],
        ['Prompt cost',(m:Model)=>price(modelPromptCost(m))],
        ['Completion cost',(m:Model)=>price(modelCompletionCost(m))],
      ].map(([label,reader])=><tr key={String(label)}><td className="p-2 font-bold text-slate-500">{String(label)}</td>{compareModels.map((model)=><td key={model.id} className="p-2 text-slate-700">{(reader as (m:Model)=>React.ReactNode)(model)}</td>)}</tr>)}</tbody></table></div>
    </ModalDialog>
  </div>;
};
