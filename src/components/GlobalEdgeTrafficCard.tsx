import React from 'react';
import { Globe2 } from 'lucide-react';

export const GlobalEdgeTrafficCard: React.FC<{
  totalRequests?: string;
  className?: string;
}> = ({ totalRequests = '—', className = '' }) => (
  <section className={`cf-panel cf-global-traffic ${className}`}>
    <div className="cf-panel-title">
      <span className="cf-panel-icon blue"><Globe2 size={14} /></span>
      <strong>Global Edge Traffic</strong>
      <span className="cf-range-pill">Observed 24h</span>
    </div>

    <div className="cf-world-visual" aria-label="Geographic request telemetry unavailable">
      <svg viewBox="0 0 360 160" role="img" aria-hidden="true" style={{width:'100%',height:100}}>
        <defs>
          <linearGradient id="neutralLand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#CBD5E1" stopOpacity="0.8"/>
            <stop offset="1" stopColor="#E2E8F0" stopOpacity="0.65"/>
          </linearGradient>
        </defs>
        <path d="M14 42l26-18 42 4 14 16-18 12-16 22-28-4-9-12-18-4z" fill="url(#neutralLand)" />
        <path d="M78 86l18 8 7 22-7 22-12-10-4-22-9-9z" fill="url(#neutralLand)" />
        <path d="M140 34l24-11 29 8 16-5 38 9 38 26-14 22-32-1-17 14-36-6-25-19-28-6-15-16z" fill="url(#neutralLand)"/>
        <path d="M200 86l25 7 8 26-15 22-19-12-11-29z" fill="url(#neutralLand)" />
        <path d="M290 108l24 1 14 14-14 10-26-8z" fill="url(#neutralLand)" />
      </svg>
      <span className="cf-map-disclaimer">Geographic telemetry unavailable</span>
    </div>

    <div className="cf-traffic-total">
      <strong>{totalRequests}</strong>
      <span>observed requests in the last 24h</span>
    </div>
  </section>
);
