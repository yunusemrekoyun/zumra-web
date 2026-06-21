'use client';

import type { ReactNode } from 'react';
import { workspaceConfigs } from '@/lib/workspace';
import type { WorkspaceScope } from '@/lib/workspace';
import { WorkspaceShell } from './workspace-shell';

export function WorkspaceScopeShell({
  children,
  scope,
  badges,
}: {
  children: ReactNode;
  scope: WorkspaceScope;
  badges?: Record<string, number>;
}) {
  return (
    <WorkspaceShell config={workspaceConfigs[scope]} badges={badges}>
      {children}
    </WorkspaceShell>
  );
}
