import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OmniRouteStatus, OperationalAlert, SystemReadiness } from '../types';

interface AppShellProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  readiness?: SystemReadiness | null;
  alerts?: OperationalAlert[] | null;
  observedRequests?: number;
  omniRouteStatus?: OmniRouteStatus | null;
  environment?: string | null;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  onRefresh,
  isRefreshing,
  readiness,
  alerts,
  observedRequests,
  omniRouteStatus,
  environment,
}) => (
  <div className="cf-app-frame">
    <Header onRefresh={onRefresh} isRefreshing={isRefreshing} readiness={readiness} alerts={alerts} omniRouteStatus={omniRouteStatus} environment={environment} />
    <div className="cf-app-body">
      <Sidebar readiness={readiness} observedRequests={observedRequests} omniRouteStatus={omniRouteStatus} />
      <main className="cf-main-canvas">{children}</main>
    </div>
  </div>
);
