import type { WorkspacePrincipal } from './infrastructure';

export type AuthorizationResource = {
  advisorId?: string;
  ownerUserId?: string;
  teacherId?: string;
};

export function canAuthorizeWorkspaceAction(
  principal: WorkspacePrincipal,
  action: string,
  resource?: AuthorizationResource,
) {
  if (principal.accountStatus !== 'active') {
    return false;
  }

  if (principal.role === 'admin') {
    return (
      principal.sessionSecurityLevel === 'mfa' &&
      principal.twoFactorEnabled
    );
  }

  if (
    principal.sessionSecurityLevel === 'pending' ||
    (action.startsWith('payment.') && principal.role === 'teacher')
  ) {
    return false;
  }

  if (principal.role === 'student') {
    return resource?.ownerUserId === principal.id;
  }

  if (principal.role === 'advisor') {
    return resource?.advisorId === principal.id;
  }

  if (principal.role === 'teacher') {
    return resource?.teacherId === principal.id;
  }

  return false;
}

export function getAuthenticatedDestination(
  principal: WorkspacePrincipal,
): string | null {
  if (principal.accountStatus !== 'active') {
    return null;
  }

  if (principal.role === 'admin') {
    if (!principal.twoFactorEnabled) {
      return '/mfa-kurulum';
    }

    return principal.sessionSecurityLevel === 'mfa' ? '/admin' : '/mfa';
  }

  if (principal.sessionSecurityLevel === 'pending') {
    return null;
  }

  const destinations = {
    advisor: '/danisman',
    student: '/ogrenci',
    teacher: '/ogretmen',
  } as const;

  return destinations[principal.role];
}
