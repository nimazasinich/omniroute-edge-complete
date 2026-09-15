import React from 'react';
import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  rawExactValue?: string | number;
  trend?: string;
  trendSuffix?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  pillBadge?: string;
  pillColor?: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  sparklineColor?: string;
  sparklinePoints?: string;
  progressPercent?: number;
  className?: string;
  onClick?: () => void;
  actionLabel?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title, value, rawExactValue, trend, trendSuffix, trendType = 'neutral',
  pillBadge, pillColor = '#15803D', subtitle,
  icon: Icon, iconColor = '#0C68F7', iconBg,
  sparklineColor, sparklinePoints, progressPercent, className = '', onClick, actionLabel,
}) => {
  const hasData = value !== 'Loading' && value !== 'No data' && value !== '—';
  const directional = trend?.startsWith('+') || trend?.startsWith('-') || trend?.startsWith('↑') || trend?.startsWith('↓');
  const down = trend?.startsWith('-') || trend?.startsWith('↓');
  const bg = iconBg || `linear-gradient(145deg, color-mix(in srgb, ${iconColor} 88%, #fff), ${iconColor} 62%, color-mix(in srgb, ${iconColor} 82%, #000))`;
  const sparkColor = sparklineColor || iconColor;
  const gradientId = `sg-${title.replace(/\s/g, '')}`;

  return (
    <article
      className={`cf-kpi-card ${onClick ? 'cf-kpi-card-interactive' : ''} ${className}`}
      title={rawExactValue ? `${title}: ${rawExactValue}` : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? (actionLabel || `Open ${title} details`) : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
    >
      <div className="cf-kpi-top">
        <div className="cf-kpi-icon" style={{ background: bg, color: '#fff', boxShadow: `0 3px 10px ${iconColor}45, inset 0 1px 0 rgba(255,255,255,.35)` }}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
        <div className="cf-kpi-body">
          <span className="cf-kpi-title">{title}</span>
          <div className="cf-kpi-value-row">
            <strong>{hasData ? value : '—'}</strong>
            {trend && <span className={`cf-kpi-trend ${trendType}`}>{directional && (down ? <ArrowDown size={8} strokeWidth={2.8} /> : <ArrowUp size={8} strokeWidth={2.8} />)}<span>{trend}</span>{trendSuffix && <em>{trendSuffix}</em>}</span>}
            {pillBadge && <span className="cf-kpi-pill" style={{ backgroundColor: pillColor }}>{pillBadge}</span>}
          </div>
        </div>
      </div>

      <div className="cf-kpi-bottom">
        {progressPercent !== undefined ? (
          <div className="cf-kpi-progress" aria-label={`${title} ${progressPercent}%`}><i style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%`, backgroundColor: iconColor }} /></div>
        ) : sparklinePoints ? (
          <svg className="cf-kpi-sparkline" viewBox="0 0 60 16" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={sparkColor} stopOpacity="0.14"/><stop offset="100%" stopColor={sparkColor} stopOpacity="0"/></linearGradient></defs>
            <polyline points={`0,16 ${sparklinePoints} 60,16`} fill={`url(#${gradientId})`} stroke="none" />
            <polyline points={sparklinePoints} fill="none" stroke={sparkColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : <span className="cf-kpi-sparkline cf-kpi-sparkline-empty" aria-hidden="true" />}
        <span className="cf-kpi-footer-text">{subtitle}</span>
      </div>
    </article>
  );
};
