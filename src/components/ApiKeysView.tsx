import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy, Key, Plus, ShieldAlert, XCircle } from 'lucide-react';
import { ApiKeyItem, DashboardData } from '../types';
import { fetchAdmin } from '../auth/adminAuth';
import { DetailGrid, DetailItem, InspectorDrawer, ModalDialog, SourcePill, WorkspaceTabs } from './WorkspacePrimitives';
import { formatDateTime } from '../utils/formatters';

export const ApiKeysView: React.FC<{ data: DashboardData }> = ({ data }) => {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<'gateway' | 'admin'>('gateway');
  const [createdKeyData, setCreatedKeyData] = useState<{ rawSecret: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'gateway' | 'admin'>('gateway');
  const [selected, setSelected] = useState<ApiKeyItem | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [mutating, setMutating] = useState(false);

  const databaseCredentialRecords = data.readiness ? data.readiness.adminKeys + data.readiness.gatewayKeys : null;
  const databaseGatewayKeys = data.readiness?.gatewayKeys ?? null;

  const fetchKeys = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchAdmin('/api/admin/keys', {});
      const payload = await res.json().catch(() => []);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKeys(Array.isArray(payload) ? payload : []);
    } catch (err) { setKeys([]); setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void fetchKeys(); }, []);

  const visibleKeys = useMemo(() => keys.filter((key) => key.role === tab), [keys, tab]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newKeyName.trim()) return;
    setMutating(true); setError(null);
    try {
      const res = await fetchAdmin('/api/admin/keys', { method: 'POST', body: JSON.stringify({ name: newKeyName, role: newKeyRole }) });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawSecret = result.rawSecret ?? result.rawKey;
      if (!rawSecret) throw new Error('Server did not return the one-time secret.');
      setCreatedKeyData({ rawSecret, name: result.name ?? newKeyName }); setIsCreateOpen(false); setNewKeyName(''); await fetchKeys();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create key'); }
    finally { setMutating(false); }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setMutating(true); setError(null);
    try {
      const res = await fetchAdmin(`/api/admin/keys/${revokeTarget.id}/revoke`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRevokeTarget(null); setSelected(null); await fetchKeys();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to revoke key'); }
    finally { setMutating(false); }
  };

  const copyToClipboard = async (text: string) => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };

  return <div className="flex flex-col gap-3 h-full w-full select-none overflow-y-auto pr-1">
    <div className="card-3d-glass p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0"><div><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-[#0051C3]/10 text-[#0051C3] flex items-center justify-center border border-[#0051C3]/20"><Key size={14}/></div><h2 className="text-[14px] font-bold text-[#0F172A]">Gateway API Keys & Secrets</h2></div><p className="text-[10.5px] text-[#475569] mt-1">Data source: stored gateway credential metadata. Raw secrets are never reloaded after the one-time creation response.</p></div><button onClick={()=>setIsCreateOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0051C3] text-white font-semibold text-[11px]"><Plus size={13}/>Create New API Key</button></div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0"><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Database credential records</span><strong className="block text-[16px]">{databaseCredentialRecords ?? (loading&&!keys.length?'—':keys.length)}</strong><small className="text-[8.5px] text-slate-400">Readiness count from hashed-key metadata</small></div><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Active</span><strong className="block text-[16px]">{keys.length?keys.filter((k)=>!k.revoked).length:'—'}</strong><small className="text-[8.5px] text-slate-400">Stored status only</small></div><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Gateway role</span><strong className="block text-[16px]">{databaseGatewayKeys ?? (keys.length?keys.filter((k)=>k.role==='gateway').length:'—')}</strong><small className="text-[8.5px] text-slate-400">Database metadata count</small></div><div className="card-3d-glass p-3"><span className="text-[9px] text-slate-500">Secret storage</span><strong className="block text-[16px]">Hashed</strong><small className="text-[8.5px] text-slate-400">One-time raw secret reveal</small></div></div>

    {error?<div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[10.5px] text-amber-800"><strong>Admin authorization required for key-list metadata.</strong> {error}. Database readiness still reports {databaseCredentialRecords ?? 'an unknown number of'} credential records.</div>:null}
    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-[11px] text-amber-900 shrink-0"><ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5"/><div><span className="font-bold">Zero-Exposure Key Policy:</span> the raw secret is shown once after generation and is never persisted as browser-readable metadata.</div></div>

    <div className="card-3d-glass p-3"><WorkspaceTabs tabs={[{id:'gateway',label:'Gateway keys',count:keys.filter((key)=>key.role==='gateway').length},{id:'admin',label:'Admin keys',count:keys.filter((key)=>key.role==='admin').length}]} active={tab} onChange={(id)=>setTab(id as 'gateway'|'admin')}/></div>

    <div className="card-3d-glass p-3.5 sm:p-4 flex flex-col flex-1 min-h-[300px]"><div className="flex items-center justify-between mb-3"><div><h3 className="text-[13px] font-bold text-[#0F172A]">Registered {tab === 'gateway' ? 'Gateway' : 'Admin'} Credentials ({visibleKeys.length})</h3><p className="mt-1 text-[9.5px] text-slate-500">Select a row for metadata and lifecycle actions.</p></div><span className="text-[10px] text-[#64748B] font-mono">Authorization: Bearer &lt;key&gt;</span></div><div className="flex-1 overflow-y-auto"><table className="w-full text-left text-[11px]"><thead className="text-[#64748B] border-b border-[#E2E8F0] bg-slate-50/50"><tr><th className="py-2 pl-2">Name / Label</th><th className="py-2">Key Secret</th><th className="py-2">Role</th><th className="py-2">Created</th><th className="py-2">Last Used</th><th className="py-2">Status</th><th className="py-2 text-right pr-2">Action</th></tr></thead><tbody className="divide-y divide-[#E2E8F0]/70">{visibleKeys.map((k)=><tr key={k.id} onClick={()=>setSelected(k)} className="cursor-pointer hover:bg-blue-50/30"><td className="py-2.5 pl-2 font-bold text-[#0F172A]">{k.name}</td><td className="py-2.5 font-mono text-[10.5px] text-[#64748B]">{k.maskedKey}</td><td className="py-2.5"><SourcePill label={k.role} tone="blue"/></td><td className="py-2.5 text-[10px] text-slate-500">{k.createdAt ? formatDateTime(k.createdAt) : 'Not recorded'}</td><td className="py-2.5 text-[10px] text-slate-500">Not observed</td><td className="py-2.5">{k.revoked?<span className="text-[#EF4444] font-semibold flex items-center gap-1 text-[10px]"><XCircle size={12}/>Revoked</span>:<span className="text-[#059669] font-semibold flex items-center gap-1 text-[10px]"><CheckCircle2 size={12}/>Active</span>}</td><td className="py-2.5 text-right pr-2">{!k.revoked?<button onClick={(event)=>{event.stopPropagation();setRevokeTarget(k);}} className="text-[10px] text-[#EF4444] hover:underline font-semibold">Revoke Key</button>:null}</td></tr>)}{!visibleKeys.length&&!loading?<tr><td colSpan={7} className="py-8 text-center text-[#64748B]">No {tab} API keys are returned by the admin API.</td></tr>:null}</tbody></table></div></div>

    <InspectorDrawer open={Boolean(selected)} onClose={()=>setSelected(null)} title="API key detail" subtitle={selected?.id ? <span className="font-mono">{selected.id}</span> : undefined} footer={<div className="text-[9px] text-slate-500">Secret value is never available from metadata after creation.</div>}>
      {selected?<div className="space-y-3"><DetailGrid><DetailItem label="Name" value={selected.name}/><DetailItem label="Role" value={selected.role}/><DetailItem label="Masked key" value={selected.maskedKey} mono/><DetailItem label="Status" value={selected.revoked?'Revoked':'Active'}/><DetailItem label="Created" value={selected.createdAt?formatDateTime(selected.createdAt):'Not recorded'}/><DetailItem label="Last used" value="Not observed"/></DetailGrid>{!selected.revoked?<button onClick={()=>setRevokeTarget(selected)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-700">Revoke this key</button>:null}</div>:null}
    </InspectorDrawer>

    <ModalDialog open={Boolean(revokeTarget)} onClose={()=>!mutating&&setRevokeTarget(null)} title="Revoke API key" description="This action cannot be undone. Existing clients using this credential will stop authenticating." size="sm" footer={<div className="flex justify-end gap-2"><button disabled={mutating} onClick={()=>setRevokeTarget(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px]">Cancel</button><button disabled={mutating} onClick={()=>void handleRevoke()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{mutating?'Revoking...':'Revoke key'}</button></div>}>
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-800"><strong>{revokeTarget?.name}</strong><div className="mt-1 font-mono text-[9px]">{revokeTarget?.maskedKey}</div></div>
    </ModalDialog>

    <ModalDialog open={isCreateOpen} onClose={()=>!mutating&&setIsCreateOpen(false)} title="Create Gateway API Key" description="Enter a descriptive label and role. The returned raw secret is shown once." size="sm">
      <form onSubmit={handleCreate} className="flex flex-col gap-3"><div><label className="text-[11px] font-bold text-[#0F172A] block mb-1">Key Label</label><input type="text" required placeholder="e.g. Production Mobile App" value={newKeyName} onChange={(e)=>setNewKeyName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#DCEBFA] text-[12px] outline-none"/></div><div><label className="text-[11px] font-bold text-[#0F172A] block mb-1">Role / Permissions</label><select value={newKeyRole} onChange={(e)=>setNewKeyRole(e.target.value==='admin'?'admin':'gateway')} className="w-full px-3 py-2 rounded-lg border border-[#DCEBFA] text-[12px]"><option value="gateway">Gateway Ingress (Inference only)</option><option value="admin">Administrator (Full control)</option></select></div><div className="flex justify-end gap-2 mt-2"><button type="button" disabled={mutating} onClick={()=>setIsCreateOpen(false)} className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[11px]">Cancel</button><button type="submit" disabled={mutating||!newKeyName.trim()} className="px-3 py-1.5 rounded-lg bg-[#0051C3] text-white font-semibold text-[11px] disabled:opacity-40">{mutating?'Creating...':'Generate Key'}</button></div></form>
    </ModalDialog>

    <ModalDialog open={Boolean(createdKeyData)} onClose={()=>setCreatedKeyData(null)} title="API Key Generated Successfully" description="Copy this secret now. You will not be able to see it again." size="sm">
      {createdKeyData?<><div className="p-3 rounded-lg bg-slate-900 text-white font-mono text-[11px] flex items-center justify-between break-all select-all"><span>{createdKeyData.rawSecret}</span><button onClick={()=>void copyToClipboard(createdKeyData.rawSecret)} className="ml-2 p-1.5 rounded-md bg-slate-800 text-white shrink-0" title="Copy Secret">{copied?<Check size={14} className="text-[#10B981]"/>:<Copy size={14}/>}</button></div><div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[9.5px] text-amber-800"><AlertCircle size={13} className="shrink-0"/><span>The UI does not store this raw secret. Closing this dialog removes it from component state.</span></div><div className="mt-3 flex justify-end"><button onClick={()=>setCreatedKeyData(null)} className="px-4 py-1.5 rounded-lg bg-[#0051C3] text-white font-semibold text-[11px]">I have saved my key</button></div></>:null}
    </ModalDialog>
  </div>;
};
