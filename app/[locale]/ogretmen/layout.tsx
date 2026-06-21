import React from 'react';
import { WorkspaceScopeShell } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getTotalUnread } from '@/lib/server/services/conversations';
import { userBadgeFromPrincipal } from '@/lib/workspace/user-badge';

export const dynamic = 'force-dynamic';

export default async function TeacherLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const unread = await getTotalUnread(principal);
  return (
    <WorkspaceScopeShell
      scope="teacher"
      badges={{ '/ogretmen/mesajlar': unread }}
      user={userBadgeFromPrincipal(principal)}
    >
      {children}
    </WorkspaceScopeShell>
  );
}
