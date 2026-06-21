'use client';

import type { ReactNode } from 'react';
import { workspaceConfigs } from '@/lib/workspace';
import type { WorkspaceScope } from '@/lib/workspace';
import type { WorkspaceUserBadgeOverride } from '@/lib/workspace/user-badge';
import { WorkspaceShell } from './workspace-shell';

export function WorkspaceScopeShell({
  children,
  scope,
  badges,
  user,
}: {
  children: ReactNode;
  scope: WorkspaceScope;
  badges?: Record<string, number>;
  user?: WorkspaceUserBadgeOverride;
}) {
  return (
    <WorkspaceShell config={workspaceConfigs[scope]} badges={badges} user={user}>
      {children}
    </WorkspaceShell>
  );
}
