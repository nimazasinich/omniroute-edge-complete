import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, GitMerge, Radio, ShieldCheck } from 'lucide-react';
import { DashboardData } from '../types';
import { formatLatency, formatNumber } from '../utils/formatters';

interface CentralHubCardProps {
  data: DashboardData;
}

function readinessLabel(data: DashboardData): string {
  if (!data.readiness) return 'No readiness data';
  if (data.readiness.ready) return 'Ready';
  const issues = data.readiness.issues.length;
  return `${issues} issue${issues === 1 ? '' : 's'}`;
}

export const CentralHubCard: React.FC<CentralHubCardProps> = ({ data }) => {
  const navigate = useNavigate();
  const observedRequests = data.stats?.totalRequests ?? 0;
  const providerCount = data.readiness?.providerCount ?? data.providers.length;
  const healthyProviders = data.readiness?.healthyProviders ?? data.providers.filter((provider) => provider.status === 'Healthy').length;
  const alertCount = data.alerts?.length ?? 0;
  const averageLatency = data.stats?.avgLatency ?? data.analytics?.avgLatencyMs ?? 0;
  const readiness = readinessLabel(data);
  const modeLabel = observedRequests > 0 ? 'Observed traffic active' : providerCount > 0 ? 'Configured, waiting for traffic' : 'No providers configured';

  return (
    <div className="card-3d-glass p-2.5 sm:p-3 flex flex-col justify-between h-full min-h-0 overflow-hidden relative">
      <div className="absolute inset-x-6 top-4 h-16 rounded-full bg-[radial-gradient(circle,rgba(244,129,32,0.18),rgba(255,255,255,0))] blur-xl pointer-events-none" />

      <div className="flex items-center justify-between gap-2 mb-1 shrink-0 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-white to-orange-50 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white flex items-center justify-center text-orange-500 shrink-0">
            <Radio size={12} strokeWidth={2.3} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] leading-tight">
              Central Control Hub
            </h3>
            <span className="text-[9px] text-slate-400 leading-none">Observed traffic, routing readiness & posture</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/topology')}
          className="text-[10px] text-[#0051C3] font-bold hover:underline cursor-pointer shrink-0"
          title="Open topology"
        >
          Topology →
        </button>
      </div>

      <div className="relative z-10 flex items-center gap-2.5 my-auto min-h-0 flex-1">
        <div className="shrink-0 flex items-center justify-center p-0.5">
          <div className="hub-asset-shell">
            <div className="hub-orbit-ring hub-orbit-ring-a" />
            <div className="hub-orbit-ring hub-orbit-ring-b" />
            <div className="hub-halo-pulse" />
            <img
              src="/dashboard-hub.png"
              alt="Cloudflare Router central hub"
              className="hub-dashboard-image"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
          <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1 min-w-0">
            <div className="flex items-center gap-1 text-slate-500 text-[8.5px]"><GitMerge size={9} /> Observed</div>
            <div className="text-[12px] font-black text-slate-900 font-mono leading-tight">{formatNumber(observedRequests)}</div>
            <div className="text-[8px] text-slate-400 truncate">{modeLabel}</div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1 min-w-0">
            <div className="flex items-center gap-1 text-slate-500 text-[8.5px]"><ShieldCheck size={9} /> Readiness</div>
            <div className="text-[12px] font-black text-slate-900 leading-tight">{readiness}</div>
            <div className="text-[8px] text-slate-400 truncate">{healthyProviders} of {providerCount}</div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1 min-w-0">
            <div className="flex items-center gap-1 text-slate-500 text-[8.5px]"><AlertTriangle size={9} /> Alerts</div>
            <div className="text-[12px] font-black text-slate-900 font-mono leading-tight">{formatNumber(alertCount)}</div>
            <div className="text-[8px] text-slate-400 truncate">{alertCount > 0 ? `${alertCount} review` : '0 alerts'}</div>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1 min-w-0">
            <div className="flex items-center gap-1 text-slate-500 text-[8.5px]"><Activity size={9} /> Latency</div>
            <div className="text-[12px] font-black text-slate-900 font-mono leading-tight">{formatLatency(averageLatency)}</div>
            <div className="text-[8px] text-slate-400 truncate">Observed routing</div>
          </div>
        </div>
      </div>

      <div className="relative z-10 pt-1 border-t border-slate-200/80 flex items-center justify-between gap-2 text-[9.5px] shrink-0">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 truncate text-[9.5px]">Central orchestration surface</div>
          <div className="text-slate-400 text-[8.5px] truncate">Subtle motion & glow</div>
        </div>
        <button
          onClick={() => navigate('/routing')}
          className="shrink-0 text-[9.5px] font-bold text-[#0051C3] hover:underline flex items-center gap-0.5"
        >
          Review routing <ArrowUpRight size={9} />
        </button>
      </div>
    </div>
  );
};
