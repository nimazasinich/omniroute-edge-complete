import React from 'react';
import { Boxes } from 'lucide-react';
import { Provider } from '../types';
import { formatLatency } from '../utils/formatters';

interface ProviderHealthCardProps {
  providers: Provider[];
  onManageClick?: () => void;
  className?: string;
}

function normalizeSuccessRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value <= 1 ? value * 100 : value;
}

export const ProviderHealthCard: React.FC<ProviderHealthCardProps> = ({ providers = [], onManageClick, className = '' }) => (
  <section className={`cf-panel cf-provider-health ${className}`}>
    <div className="cf-panel-title">
      <span className="cf-panel-icon blue"><Boxes size={16} /></span>
      <strong>Provider Health</strong>
      {providers.length > 6 && <small className="cf-panel-summary">Showing 6 of {providers.length}</small>}
      <button onClick={onManageClick}>View details →</button>
    </div>
    <div className="cf-provider-table">
      <div className="cf-provider-head" style={{gridTemplateColumns:'minmax(72px,1.3fr) 60px 52px 68px minmax(52px,.9fr) 46px'}}>
        <span>Provider</span><span>Status</span><span>Latency</span><span>Success Rate</span><span>Traffic Share</span><span>Cost/1M</span>
      </div>
      {providers.slice(0, 6).map((provider) => {
        const traffic = Number(provider.trafficSharePct ?? 0);
        const rawHealth = (provider.healthStatus || 'unknown').toLowerCase();
        const statusClass = rawHealth === 'healthy' ? 'healthy' : rawHealth === 'degraded' ? 'degraded' : rawHealth === 'offline' ? 'offline' : 'unknown';
        const statusLabel = rawHealth === 'unknown' ? 'Unknown' : rawHealth.charAt(0).toUpperCase() + rawHealth.slice(1);
        const latencyMs = provider.latencyMs ?? null;
        const successPct = normalizeSuccessRate(provider.successRate);
        const costPerM = provider.costPerToken != null && Number.isFinite(provider.costPerToken)
          ? provider.costPerToken * 1_000_000
          : null;
        return (
          <div className="cf-provider-row" key={provider.id}
            style={{gridTemplateColumns:'minmax(72px,1.3fr) 60px 52px 68px minmax(52px,.9fr) 46px'}}
            title={provider.healthSource === 'legacy_snapshot' ? 'Live provider health unavailable; inventory loaded from local snapshot.' : undefined}>
            <span className="provider-name"><i className="provider-glyph">◆</i>{provider.name}</span>
            <span className={`provider-status ${statusClass}`}><i />{statusLabel}</span>
            <span>{latencyMs != null ? formatLatency(latencyMs) : '—'}</span>
            <span>{successPct != null ? `${successPct.toFixed(1)}%` : '—'}</span>
            <span className="traffic-cell">
              <i><b style={{ width: `${Math.max(0, Math.min(100, traffic))}%` }} /></i>
              {traffic > 0 ? `${traffic.toFixed(1)}%` : '—'}
            </span>
            <span>{costPerM != null ? `$${costPerM.toFixed(2)}` : '—'}</span>
          </div>
        );
      })}
      {providers.length === 0 && <div className="cf-empty-row">No provider inventory available.</div>}
    </div>
  </section>
);
