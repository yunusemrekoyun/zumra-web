import React from 'react';
import { WorkspaceScopeShell } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getTotalUnread } from '@/lib/server/services/conversations';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const unread = await getTotalUnread(principal);
  return (
    <WorkspaceScopeShell scope="student" badges={{ '/ogrenci/mesajlar': unread }}>
      {children}
    </WorkspaceScopeShell>
  );
}
