import 'server-only';

import type { ComponentType } from 'react';
import type { UserRole } from '@/lib/domain';
import { requireWorkspaceRole } from '@/lib/server/authorization';

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export function withWorkspacePage(
  role: UserRole,
  Page: ComponentType,
) {
  return async function ProtectedWorkspacePage({
    params,
  }: LocalePageProps) {
    const { locale } = await params;
    await requireWorkspaceRole(role, locale);

    return <Page />;
  };
}
