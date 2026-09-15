import React from 'react';
import { Activity, Clock, Cpu, KeyRound, Zap } from 'lucide-react';
import { DashboardData } from '../types';
import { formatLatency, formatNumber, formatRelativeTime } from '../utils/formatters';

export const RuntimeResourcesCard: React.FC<{ data: DashboardData; onDetailsClick?: () => void }> = ({ data, onDetailsClick }) => {
  const runtimeAvailable = Boolean(data.runtime?.available);
  const runtimeUsedMb = runtimeAvailable && data.runtime?.heapUsedMb !== null ? data.runtime?.heapUsedMb ?? null : null;
  const runtimeTotalMb = runtimeAvailable && data.runtime?.heapTotalMb !== null ? data.runtime?.heapTotalMb ?? null : null;
  const usedGb = runtimeUsedMb != null ? runtimeUsedMb / 1024 : null;
  const totalGb = runtimeTotalMb != null ? runtimeTotalMb / 1024 : null;
  const memoryPct = usedGb !== null && totalGb !== null && totalGb > 0 ? Math.min(100, Math.round((usedGb / totalGb) * 100)) : null;
  const availableGb = usedGb !== null && totalGb !== null ? Math.max(0, totalGb - usedGb) : null;

  const readiness = data.readiness;
  const modelEnablePct = readiness && readiness.modelCount > 0
    ? Math.min(100, Math.round((readiness.enabledModelCount / readiness.modelCount) * 100))
    : null;
  const primaryPct = runtimeAvailable ? memoryPct : modelEnablePct;

  const cpu = data.analytics?.cpuUsage ?? null;
  const rps = data.analytics?.requestsPerSec ?? null;
  const latency = data.analytics?.avgExecution ?? data.analytics?.avgLatencyMs ?? data.stats?.avgLatency ?? null;
  const series = data.analytics?.requestVolumeSeries ?? [];

  const chartPoints = series.length > 1 ? series.slice(-24).map((point, index, all) => {
    const values = all.map((entry) => entry.count);
    const max = Math.max(1, ...values);
    const x = (index / (all.length - 1)) * 100;
    const y = 42 - (point.count / max) * 36;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') : null;
  const maxObserved = series.length ? Math.max(...series.map((point) => point.count)) : null;

  const usedDeg = primaryPct != null ? (primaryPct / 100) * 360 : 0;
  const donutStyle = primaryPct !== null
    ? { background: `conic-gradient(#2563EB 0deg ${usedDeg}deg, #E2EAF8 ${usedDeg}deg 360deg)` }
    : { background: '#EEF2F7' };

  const resourceRows = runtimeAvailable
    ? [
        { label: 'Used', val: usedGb != null ? `${usedGb.toFixed(2)} GB` : '—', color: '#2563EB' },
        { label: 'Available', val: availableGb != null ? `${availableGb.toFixed(2)} GB` : '—', color: '#8B5CF6' },
        { label: 'Heap total', val: totalGb != null ? `${totalGb.toFixed(2)} GB` : '—', color: '#CBD5E1' },
      ]
    : [
        { label: 'Models enabled', val: readiness ? `${readiness.enabledModelCount}/${readiness.modelCount}` : '—', color: '#2563EB' },
        { label: 'Providers enabled', val: readiness ? `${readiness.enabledProviders}/${readiness.providerCount}` : '—', color: '#8B5CF6' },
        { label: 'Gateway keys', val: readiness ? String(readiness.gatewayKeys) : '—', color: '#10B981' },
      ];

  return (
    <section className="cf-panel cf-runtime-card">
      <div className="cf-panel-title">
        <span className="cf-panel-icon blue">{runtimeAvailable ? <Cpu size={16} /> : <KeyRound size={16} />}</span>
        <strong>{runtimeAvailable ? 'Runtime Resources' : 'Control Plane Resources'}</strong>
        {onDetailsClick ? <button onClick={onDetailsClick}>{runtimeAvailable ? 'Runtime detail →' : 'Control-plane detail →'}</button> : <span className="cf-range-pill">{runtimeAvailable ? 'Local Node + observed 24h' : 'D1 readiness + observed 24h'}</span>}
      </div>

      <div className="cf-runtime-main">
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flexShrink:0}}>
          <div className="cf-memory-donut" style={donutStyle}>
            <div style={{position:'relative',zIndex:1,textAlign:'center'}}>
              <strong style={{fontSize:14,fontWeight:900,color:'#0F172A',lineHeight:1}}>
                {primaryPct !== null ? `${primaryPct}%` : '—'}
              </strong>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:2}}>
            {resourceRows.map((item) => (
              <div key={item.label} style={{display:'flex',alignItems:'center',gap:4,fontSize:7.5,color:'#475569'}}>
                <span style={{width:6,height:6,borderRadius:2,background:item.color,flexShrink:0}}/>
                <span>{item.label}</span>
                <span style={{marginLeft:'auto',fontWeight:700,color:'#1E293B',paddingLeft:4}}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cf-runtime-chart" style={{flex:1,minWidth:0}}>
          <strong style={{fontSize:9,color:'#1E40A0',fontWeight:700}}>Observed Request Volume</strong>
          <svg viewBox="0 0 100 48" preserveAspectRatio="none" aria-label="Observed request-volume trend"
            style={{display:'block',width:'100%',height:60,marginTop:2,border:'1px solid #E0ECF6',borderRadius:5,background:'linear-gradient(180deg,#fff,#f7faff)'}}>
            <defs>
              <linearGradient id="rtFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3B82F6" stopOpacity=".22"/>
                <stop offset="1" stopColor="#3B82F6" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {chartPoints ? (
              <>
                <polyline points={`0,46 ${chartPoints} 100,46`} fill="url(#rtFill)" stroke="none"/>
                <polyline points={chartPoints} fill="none" stroke="#2563EB" strokeWidth="1.4" vectorEffect="non-scaling-stroke"/>
                <text x="2" y="7" fontSize="4.5" fill="#94A3B8">max {formatNumber(maxObserved ?? 0)}</text>
              </>
            ) : (
              <>
                <line x1="0" x2="100" y1="30" y2="30" stroke="#CBD5E1" strokeDasharray="4 4"/>
                <text x="50" y="27" textAnchor="middle" fontSize="5" fill="#94A3B8">No observed request history</text>
              </>
            )}
          </svg>
        </div>
      </div>

      <div className="cf-runtime-metrics">
        {runtimeAvailable ? (
          <>
            <div>
              <span><Activity size={11}/>CPU Usage</span>
              <strong style={{color: cpu!=null&&cpu>80?'#DC2626':cpu!=null&&cpu>60?'#D97706':'#059669'}}>{cpu !== null ? `${Math.round(cpu)}%` : '—'}</strong>
            </div>
            <div><span><Zap size={11}/>Requests/sec</span><strong style={{color:'#2563EB'}}>{rps !== null ? formatNumber(rps) : '—'}</strong></div>
            <div><span><Clock size={11}/>Avg Response</span><strong style={{color:'#7C3AED'}}>{latency != null && latency > 0 ? formatLatency(latency) : '—'}</strong></div>
          </>
        ) : (
          <>
            <div><span><Activity size={11}/>Errors 24h</span><strong style={{color:(readiness?.errorCount24h ?? 0)>0?'#DC2626':'#059669'}}>{readiness ? formatNumber(readiness.errorCount24h) : '—'}</strong></div>
            <div><span><Zap size={11}/>Blocked 24h</span><strong style={{color:(readiness?.blockedCount24h ?? 0)>0?'#D97706':'#2563EB'}}>{readiness ? formatNumber(readiness.blockedCount24h) : '—'}</strong></div>
            <div><span><Clock size={11}/>Last Request</span><strong style={{color:'#7C3AED'}}>{readiness?.lastRequestAt ? formatRelativeTime(readiness.lastRequestAt) : 'None observed'}</strong></div>
          </>
        )}
      </div>
    </section>
  );
};
