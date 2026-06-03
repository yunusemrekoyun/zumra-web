'use client';

import React from 'react';
import { DashboardRouteTransition } from './route-animation-engine';

type StudentRouteTransitionProps = {
  children: React.ReactNode;
  routeKey: string;
};

export function StudentRouteTransition({ children, routeKey }: StudentRouteTransitionProps) {
  return (
    <DashboardRouteTransition routeKey={routeKey} scope="student">
      {children}
    </DashboardRouteTransition>
  );
}
