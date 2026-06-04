'use client';

import React from 'react';
import { WorkspaceShell } from '@/components/ui';
import { workspaceConfigs } from '@/lib/workspace';

export default function AdvisorLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell config={workspaceConfigs.advisor}>{children}</WorkspaceShell>;
}
