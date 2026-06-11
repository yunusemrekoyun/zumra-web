import React from 'react';
import { WorkspaceScopeShell } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';

export const dynamic = 'force-dynamic';

export default async function TeacherLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireWorkspaceRole('teacher', locale);
  return <WorkspaceScopeShell scope="teacher">{children}</WorkspaceScopeShell>;
}
