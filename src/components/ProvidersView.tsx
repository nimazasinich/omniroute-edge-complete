import React, { useMemo, useState } from 'react';
import { Boxes, Database, KeyRound, RefreshCw, Search, Server, Waypoints } from 'lucide-react';
import type { DashboardData, Provider } from '../types';
import { MetricTile, PageHeader, SourceBadge } from './PagePrimitives';
import { DetailGrid, DetailItem, InspectorDrawer, ProgressBar, SourcePill, WorkspaceTabs } from './WorkspacePrimitives';
import { formatLatency, formatNumber } from '../utils/formatters';

const providerTabs = ['Overview', 'Models', 'Health', 'Traffic', 'Credentials', 'Configuration', 'History'];

export const ProvidersSection: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled' | 'observed'>('all');
  const [selected, setSelected] = useState<Provider | null>(null);
  const [tab, setTab] = useState('Overview');

  const rows = useMemo(() => data.providers.filter((provider) => {
    const term = query.trim().toLowerCase();
    if (term && ![provider.name, provider.baseUrl, provider.type, provider.id].some((value) => String(value ?? '').toLowerCase().includes(term))) return false;
    if (filter === 'enabled') return provider.enabled;
    if (filter === 'disabled') return !provider.enabled;
    if (filter === 'observed') return (provider.requestsLast24h ?? 0) > 0;
    return true;
  }), [data.providers, filter, query]);

  const enabled = data.providers.filter((p) => p.enabled).length;
  const observed = data.providers.filter((p) => (p.requestsLast24h ?? 0) > 0).length;
  const authoritative = data.providers.filter((p) => p.healthSource === 'omniroute').length;
  const credentialsConfigured = data.providers.filter((p) => p.hasApiKey).length;
  const healthAuthority = authoritative > 0 ? `${authoritative} providers` : 'Unavailable';
  const selectedModels = selected ? data.models.filter((model) => model.providerId === selected.id) : [];

  const openProvider = (provider: Provider) => { setSelected(provider); setTab('Overview'); };

  return (
    <div className="flex flex-col gap-3 h-full w-full overflow-y-auto pr-1">
      <PageHeader icon={Boxes} title="Provider inventory" badge="Read-only" description="Complete configured provider inventory with observed edge traffic. OmniRoute owns live health, provider selection and failover." actions={<button onClick={() => data.refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-blue-700"><RefreshCw size={12} className={data.loading ? 'animate-spin' : ''}/>Refresh</button>}/>

      <section className="grid grid-cols-2 xl:grid-cols-6 gap-2.5">
        <MetricTile label="Provider records" value={formatNumber(data.providers.length)} note="Data source: inventory read model" />
        <MetricTile label="Enabled snapshot" value={formatNumber(enabled)} note="Configuration metadata, not routing authority" />
        <MetricTile label="Observed traffic" value={formatNumber(observed)} note="Providers with attributed requests" />
        <MetricTile label="Credential metadata" value={formatNumber(credentialsConfigured)} note="Encrypted provider credentials configured; secrets are never exposed" />
        <MetricTile label="Authoritative health" value={healthAuthority} note={authoritative ? 'Reported by OmniRoute source' : 'Snapshot health is not treated as live'} />
        <MetricTile label="OmniRoute connectivity" value={data.omniRouteStatus?.reachable === true ? 'Reachable' : data.omniRouteStatus?.reachable === false ? 'Unreachable' : data.omniRouteStatus?.configured ? 'Unknown' : 'Not configured'} note={data.omniRouteStatus?.latencyMs != null ? `${data.omniRouteStatus.latencyMs} ms probe` : '/v1/models probe'} />
      </section>

      <section className="card-3d-glass p-4 flex-1 min-h-[390px]">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="mr-auto"><div className="flex items-center gap-2"><h3 className="text-[12px] font-bold">Observed provider metadata</h3><SourceBadge>Inventory + request attribution</SourceBadge></div><p className="text-[9.5px] text-slate-500 mt-1">Select a row to open the Provider inspector. Snapshot health/latency is retained for provenance but never promoted to authoritative live health.</p></div>
          <label className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 h-8 bg-white"><Search size={12} className="text-slate-400"/><input aria-label="Search providers" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search providers" className="outline-none text-[10px] w-[170px]"/></label>
          <select aria-label="Provider filter" value={filter} onChange={(e)=>setFilter(e.target.value as typeof filter)} className="h-8 border border-slate-200 rounded-lg bg-white px-2 text-[10px]"><option value="all">All providers</option><option value="enabled">Enabled snapshot</option><option value="disabled">Disabled snapshot</option><option value="observed">Observed traffic</option></select>
          <span className="text-[9px] font-mono text-slate-500">Showing {rows.length} of {data.providers.length}</span>
        </div>
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1040px] text-left text-[10px]">
            <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr><th className="p-2">Provider</th><th className="p-2">Inventory state</th><th className="p-2">Credential</th><th className="p-2">Health authority</th><th className="p-2">Observed requests</th><th className="p-2">Observed latency</th><th className="p-2">Traffic share</th><th className="p-2">Endpoint</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((provider) => {
                const live = provider.healthSource === 'omniroute';
                const share = provider.trafficSharePct ?? 0;
                return <tr key={provider.id} onClick={() => openProvider(provider)} className="cursor-pointer hover:bg-blue-50/40"><td className="p-2"><div className="font-semibold text-slate-900">{provider.name}</div><div className="text-[8.8px] text-slate-400 font-mono">{provider.id}</div></td><td className="p-2"><div>{provider.enabled ? 'Enabled' : 'Disabled'}</div><div className="text-[8.8px] text-slate-400">Snapshot: {provider.snapshotHealthStatus ?? 'unknown'}</div></td><td className="p-2"><SourcePill label={provider.hasApiKey ? 'Encrypted stored' : 'Not stored'} tone={provider.hasApiKey ? 'blue' : 'slate'}/></td><td className="p-2"><SourcePill label={live ? provider.status : 'Unknown live health'} tone={live && provider.status === 'Healthy' ? 'green' : live && provider.status === 'Degraded' ? 'amber' : 'slate'}/></td><td className="p-2 font-mono">{(provider.requestsLast24h ?? 0) > 0 ? formatNumber(provider.requestsLast24h ?? 0) : '—'}</td><td className="p-2 font-mono">{live && provider.latencyMs != null ? formatLatency(provider.latencyMs) : '—'}</td><td className="p-2"><div className="flex items-center gap-2"><ProgressBar value={share}/><span className="w-10 text-right font-mono">{share > 0 ? `${share.toFixed(1)}%` : '—'}</span></div></td><td className="p-2 font-mono text-[8.8px] text-slate-500 max-w-[280px] truncate" title={provider.baseUrl}>{provider.baseUrl || '—'}</td></tr>;
              })}
              {!rows.length ? <tr><td colSpan={8} className="p-10 text-center text-slate-500">No provider records match this filter.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[9.3px] text-slate-500"><div className="rounded-lg bg-slate-50 border border-slate-200 p-2 flex gap-2"><Server size={13}/>Inventory can render from the complete local snapshot.</div><div className="rounded-lg bg-slate-50 border border-slate-200 p-2 flex gap-2"><Waypoints size={13}/>Routing decisions remain exclusively in OmniRoute.</div><div className="rounded-lg bg-slate-50 border border-slate-200 p-2 flex gap-2"><Database size={13}/>No provider probe is fabricated from snapshot metadata.</div></div>
      </section>

      <InspectorDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Provider inspector" subtitle={selected ? <span className="font-mono">{selected.id}</span> : undefined} footer={<div className="flex items-center justify-between text-[9px] text-slate-500"><span>Management mutations are read-only in this build.</span><SourcePill label={selected?.healthSource === 'omniroute' ? 'LIVE · OMNIROUTE' : 'REFERENCE · SNAPSHOT'} tone={selected?.healthSource === 'omniroute' ? 'green' : 'slate'}/></div>}>
        {selected ? <div className="space-y-3">
          <WorkspaceTabs tabs={providerTabs.map((label) => ({ id: label, label, count: label === 'Models' ? selectedModels.length : undefined }))} active={tab} onChange={setTab}/>
          {tab === 'Overview' ? <DetailGrid><DetailItem label="Name" value={selected.name}/><DetailItem label="Provider ID" value={selected.id} mono/><DetailItem label="Inventory state" value={selected.enabled ? 'Enabled' : 'Disabled'}/><DetailItem label="Endpoint" value={selected.baseUrl || '—'} mono/><DetailItem label="Observed requests" value={(selected.requestsLast24h ?? 0) > 0 ? formatNumber(selected.requestsLast24h ?? 0) : 'Not observed'}/><DetailItem label="Traffic share" value={(selected.trafficSharePct ?? 0) > 0 ? `${selected.trafficSharePct?.toFixed(1)}%` : 'Not observed'}/></DetailGrid> : null}
          {tab === 'Models' ? <div className="grid gap-2">{selectedModels.map((model) => <div key={model.id} className="rounded-xl border border-slate-200 p-2.5"><div className="font-semibold text-[10.5px] text-slate-800">{model.name || model.id}</div><div className="mt-1 font-mono text-[8.5px] text-slate-400">{model.id}</div></div>)}{!selectedModels.length ? <p className="text-[10px] text-slate-500">No model rows are associated with this provider in the current inventory.</p> : null}</div> : null}
          {tab === 'Health' ? <DetailGrid><DetailItem label="Health authority" value={selected.healthSource === 'omniroute' ? 'OmniRoute' : 'Unavailable'}/><DetailItem label="Live health" value={selected.healthSource === 'omniroute' ? selected.status : 'Unknown'}/><DetailItem label="Observed latency" value={selected.healthSource === 'omniroute' ? formatLatency(selected.latencyMs) : 'Not observed'}/><DetailItem label="Snapshot health" value={selected.snapshotHealthStatus ?? 'Unknown'}/></DetailGrid> : null}
          {tab === 'Traffic' ? <div className="space-y-3"><DetailGrid><DetailItem label="Observed requests" value={(selected.requestsLast24h ?? 0) || 'Not observed'}/><DetailItem label="Traffic share" value={(selected.trafficSharePct ?? 0) > 0 ? `${selected.trafficSharePct?.toFixed(1)}%` : 'Not observed'}/></DetailGrid><ProgressBar value={selected.trafficSharePct}/><p className="text-[9px] text-slate-500">Traffic values are request-attribution observations, not routing weights.</p></div> : null}
          {tab === 'Credentials' ? <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><KeyRound size={14} className="text-blue-600"/><strong className="text-[11px]">Credential metadata</strong></div><p className="mt-2 text-[9.5px] text-slate-500">{selected.hasApiKey ? 'An encrypted provider credential is recorded. Raw secret material is never returned to this workspace.' : 'No stored provider credential metadata is present for this provider.'}</p></div> : null}
          {tab === 'Configuration' ? <DetailGrid><DetailItem label="Priority snapshot" value={selected.priority}/><DetailItem label="Enabled snapshot" value={selected.enabled ? 'Yes' : 'No'}/><DetailItem label="Type" value={selected.type ?? 'Unknown'}/><DetailItem label="Endpoint" value={selected.baseUrl || '—'} mono/></DetailGrid> : null}
          {tab === 'History' ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-[10px] text-slate-500">Provider configuration History is not available from the current read model. No mutation history is fabricated.</div> : null}
        </div> : null}
      </InspectorDrawer>
    </div>
  );
};
