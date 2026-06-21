import React from 'react';
import { WorkspaceScopeShell } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { userBadgeFromPrincipal } from '@/lib/workspace/user-badge';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  return (
    <WorkspaceScopeShell
      scope="admin"
      user={userBadgeFromPrincipal(principal)}
    >
      {children}
    </WorkspaceScopeShell>
  );
}
