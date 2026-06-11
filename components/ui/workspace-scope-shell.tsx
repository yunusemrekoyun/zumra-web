'use client';

import type { ReactNode } from 'react';
import { workspaceConfigs } from '@/lib/workspace';
import type { WorkspaceScope } from '@/lib/workspace';
import { WorkspaceShell } from './workspace-shell';

export function WorkspaceScopeShell({
  children,
  scope,
}: {
  children: ReactNode;
  scope: WorkspaceScope;
}) {
  return (
    <WorkspaceShell config={workspaceConfigs[scope]}>{children}</WorkspaceShell>
  );
}
