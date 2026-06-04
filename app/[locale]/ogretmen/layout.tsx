'use client';

import React from 'react';
import { WorkspaceShell } from '@/components/ui';
import { workspaceConfigs } from '@/lib/workspace';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell config={workspaceConfigs.teacher}>{children}</WorkspaceShell>;
}
