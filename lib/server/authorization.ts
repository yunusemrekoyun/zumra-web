import 'server-only';

import { verifyPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type {
  AuthorizationService,
  SessionSecurityLevel,
  WorkspacePrincipal,
} from '@/lib/domain';
import { canAuthorizeWorkspaceAction } from '@/lib/domain';
import type { UserRole } from '@/lib/domain/types';
import { auth } from '@/lib/server/auth';
import { database } from '@/lib/server/db/client';
import { accounts } from '@/lib/server/db/schema';
import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
} from '@/lib/server/http/errors';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import { hashToken } from '@/lib/server/security/tokens';

export const authorizationService: AuthorizationService = {
  async authorize(principal, action, resource) {
    return canAuthorizeWorkspaceAction(principal, action, resource);
  },

  async requireRole(principal, roles) {
    const expected = Array.isArray(roles) ? roles : [roles];

    if (!expected.includes(principal.role)) {
      throw new AuthorizationDeniedError('Role is not authorized.');
    }
  },
};

export async function getSessionPrincipal(): Promise<WorkspacePrincipal | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const user = session.user as typeof session.user & {
    accountStatus?: WorkspacePrincipal['accountStatus'];
    role?: UserRole;
    twoFactorEnabled?: boolean;
  };
  const sessionData = session.session as typeof session.session & {
    lastVerifiedAt?: Date | string | null;
    securityLevel?: SessionSecurityLevel;
  };

  return {
    accountStatus: user.accountStatus ?? 'pending',
    email: user.email,
    id: user.id,
    name: user.name,
    role: user.role ?? 'student',
    sessionCreatedAt: sessionData.createdAt.toISOString(),
    sessionId: sessionData.id,
    sessionLastVerifiedAt: sessionData.lastVerifiedAt
      ? new Date(sessionData.lastVerifiedAt).toISOString()
      : undefined,
    sessionSecurityLevel: sessionData.securityLevel ?? 'pending',
    twoFactorEnabled: user.twoFactorEnabled ?? false,
  };
}

export async function requireSession() {
  const principal = await getSessionPrincipal();

  if (!principal) {
    throw new AuthenticationRequiredError('Authentication is required.');
  }

  if (principal.accountStatus !== 'active') {
    throw new AuthorizationDeniedError('Account is not active.');
  }

  if (principal.sessionSecurityLevel === 'pending') {
    throw new AuthorizationDeniedError('Device verification is required.');
  }

  return principal;
}

export async function requireFreshSession() {
  const principal = await requireSession();
  const verifiedAt =
    principal.sessionLastVerifiedAt ?? principal.sessionCreatedAt;
  const verificationAge = Date.now() - new Date(verifiedAt).getTime();

  if (verificationAge > 15 * 60 * 1000) {
    throw new AuthorizationDeniedError('Fresh authentication is required.');
  }

  return principal;
}

export async function requireCriticalAdmin(password: string) {
  const principal = await requireFreshSession();

  if (
    principal.role !== 'admin' ||
    principal.sessionSecurityLevel !== 'mfa' ||
    !principal.twoFactorEnabled
  ) {
    throw new AuthorizationDeniedError('Admin MFA is required.');
  }

  const limit = await consumeRateLimit(
    `critical-admin:${principal.id}`,
    5,
    15 * 60 * 1000,
  );

  if (!limit.allowed) {
    throw new AuthorizationDeniedError('Critical action rate limit exceeded.');
  }

  const [credential] = await database
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, principal.id),
        eq(accounts.providerId, 'credential'),
      ),
    )
    .limit(1);

  if (
    !credential?.password ||
    !(await verifyPassword({ hash: credential.password, password }))
  ) {
    throw new AuthorizationDeniedError('Password confirmation failed.');
  }

  return principal;
}

export async function requireAdminSession() {
  const principal = await requireSession();

  if (
    principal.role !== 'admin' ||
    principal.sessionSecurityLevel !== 'mfa' ||
    !principal.twoFactorEnabled
  ) {
    throw new AuthorizationDeniedError('Admin MFA is required.');
  }

  return principal;
}

export async function requireFreshStudentPassword(
  password: string,
  action: string,
  ip?: string,
) {
  const principal = await requireFreshSession();

  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const limit = await consumeRateLimit(
    `student-confirm:${action}:${principal.id}:${hashToken(ip ?? 'unknown')}`,
    5,
    15 * 60 * 1000,
  );

  if (!limit.allowed) {
    throw new AuthorizationDeniedError(
      'Student confirmation rate limit exceeded.',
    );
  }

  const [credential] = await database
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, principal.id),
        eq(accounts.providerId, 'credential'),
      ),
    )
    .limit(1);

  if (
    !credential?.password ||
    !(await verifyPassword({ hash: credential.password, password }))
  ) {
    throw new AuthorizationDeniedError('Password confirmation failed.');
  }

  return principal;
}

export async function requireRole(roles: UserRole | UserRole[]) {
  const principal = await requireSession();
  await authorizationService.requireRole(principal, roles);
  return principal;
}

export async function requireWorkspaceRole(role: UserRole, locale: string) {
  const principal = await getSessionPrincipal();

  if (!principal) {
    redirect(`/${locale}/giris`);
  }

  if (principal.role !== role) {
    notFound();
  }

  if (
    principal.accountStatus !== 'active' ||
    principal.sessionSecurityLevel === 'pending' ||
    (role === 'admin' &&
      (principal.sessionSecurityLevel !== 'mfa' ||
        !principal.twoFactorEnabled))
  ) {
    redirect(`/${locale}/yetkisiz`);
  }

  return principal;
}
