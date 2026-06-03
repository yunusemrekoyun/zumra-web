'use client';

import React from 'react';
import {
  DashboardRouteTransition,
  useDashboardRouteNavigation,
} from '@/components/ui/route-animation-engine';

type AdminRouteTransitionProps = {
  children: React.ReactNode;
  routeKey: string;
};

export function useAdminRouteNavigation(currentPath: string) {
  return useDashboardRouteNavigation({
    currentPath,
    rootSelector: '[data-dashboard-route-root="admin"]',
    warmupHeaders: {
      'x-admin-route-warmup': '1',
    },
  });
}

export function AdminRouteTransition({ children, routeKey }: AdminRouteTransitionProps) {
  return (
    <DashboardRouteTransition routeKey={routeKey} scope="admin">
      {children}
    </DashboardRouteTransition>
  );
}
