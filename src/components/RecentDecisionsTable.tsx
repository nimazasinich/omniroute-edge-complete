import React, { useMemo, useState } from 'react';
import { Activity, Code, FileText, GitCompareArrows, Image, Layers, MessageSquare, Search } from 'lucide-react';
import { RoutingDecision } from '../types';
import { formatDateTime, formatLatency } from '../utils/formatters';

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'chat completion':    { icon: MessageSquare, color: '#2563EB', bg: '#EFF6FF' },
  'chat':               { icon: MessageSquare, color: '#2563EB', bg: '#EFF6FF' },
  'code generation':    { icon: Code,          color: '#EA580C', bg: '#FFF7ED' },
  'code':               { icon: Code,          color: '#EA580C', bg: '#FFF7ED' },
  'document analysis':  { icon: FileText,      color: '#16A34A', bg: '#F0FDF4' },
  'document':           { icon: FileText,      color: '#16A34A', bg: '#F0FDF4' },
  'embedding':          { icon: Layers,        color: '#0F766E', bg: '#F0FDFA' },
  'embeddings':         { icon: Layers,        color: '#0F766E', bg: '#F0FDFA' },
  'image analysis':     { icon: Image,         color: '#7C3AED', bg: '#F5F3FF' },
  'image':              { icon: Image,         color: '#7C3AED', bg: '#F5F3FF' },
};

function getTypeConfig(requestType: string) {
  const key = (requestType || '').toLowerCase();
  for (const [match, value] of Object.entries(typeConfig)) {
    if (key.includes(match)) return value;
  }
  return { icon: Activity, color: '#64748B', bg: '#F1F5F9' };
}

export const RecentDecisionsTable: React.FC<{ history: RoutingDecision[]; className?: string; onViewAll?: () => void }> = ({ history = [], className = '', onViewAll }) => {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => history.filter((item) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [item.requestType, item.selectedModel, item.routingReason].some((value) => value?.toLowerCase().includes(term));
  }).slice(0, 6), [history, query]);

  return (
    <section className={`cf-panel cf-decisions ${className}`}>
      <div className="cf-panel-title">
        <span className="cf-panel-icon blue"><GitCompareArrows size={16} /></span>
        <strong>Recent AI Routing Decisions</strong>
        {onViewAll ? <button onClick={onViewAll}>View all →</button> : null}
      </div>
      <div className="cf-table-tools">
        <span>Last 3 hours</span>
        <label style={{flex:1}}>
          <Search size={11}/>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests..."/>
        </label>
      </div>
      <div className="cf-decision-table">
        <div className="cf-decision-head" style={{gridTemplateColumns:'52px 96px 102px minmax(90px,1fr) 60px'}}>
          <span>Time</span><span>Request Type</span><span>Selected Model</span><span>Action</span><span>Latency</span>
        </div>
        {rows.map((item, index) => {
          const type = getTypeConfig(item.requestType || '');
          const TypeIcon = type.icon;
          return (
            <div className="cf-decision-row" key={item.id ?? `${item.timestamp}-${index}`}
              style={{gridTemplateColumns:'52px 96px 102px minmax(90px,1fr) 60px'}}>
              <span className="mono">{formatDateTime(item.timestamp)}</span>
              <span style={{display:'flex',alignItems:'center',gap:'4px'}}>
                <span style={{width:16,height:16,borderRadius:4,background:type.bg,color:type.color,display:'grid',placeItems:'center',flexShrink:0}}>
                  <TypeIcon size={9}/>
                </span>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.requestType || 'Unknown'}</span>
              </span>
              <span>{item.selectedModel || '—'}</span>
              <span title={item.routingReason || undefined}>{item.routingReason || '—'}</span>
              <span className="mono" style={{fontWeight:700,color: item.latency>500?'#DC2626':item.latency>200?'#D97706':'#059669'}}>
                {item.latency > 0 ? formatLatency(item.latency) : '—'}
              </span>
            </div>
          );
        })}
        {rows.length === 0 && <div className="cf-empty-row">No observed gateway requests recorded.</div>}
      </div>
    </section>
  );
};
