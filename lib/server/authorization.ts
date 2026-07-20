import 'server-only';

import { verifyPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import type {
  AuthorizationService,
  SessionSecurityLevel,
  WorkspacePrincipal,
} from '@/lib/domain';
import { canAuthorizeWorkspaceAction } from '@/lib/domain';
import type { UserRole } from '@/lib/domain/types';
import { auth } from '@/lib/server/auth';
import { database } from '@/lib/server/db/client';
import { accounts, sessions, studentProfiles } from '@/lib/server/db/schema';
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

// Memoized per request so the layout + page + nested page share a single
// session lookup instead of hitting Better Auth (and the DB) 2-3 times.
export const getSessionPrincipal = cache(
  async (): Promise<WorkspacePrincipal | null> => {
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
  },
);

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
  const principal = await requireAdminSession();

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

  const storedHash = credential?.password;
  const passwordValid =
    Boolean(storedHash) &&
    (await verifyPassword({ hash: storedHash as string, password }));

  if (!passwordValid) {
    // Only failed confirmations consume the rate limit, so legitimate repeated
    // critical actions are never locked out while brute-force stays bounded.
    const limit = await consumeRateLimit(
      `critical-admin:${principal.id}`,
      5,
      15 * 60 * 1000,
    );

    if (!limit.allowed) {
      throw new AuthorizationDeniedError(
        'Critical action rate limit exceeded.',
      );
    }

    throw new AuthorizationDeniedError('Password confirmation failed.');
  }

  const verifiedAt = new Date();
  const [refreshedSession] = await database
    .update(sessions)
    .set({
      lastVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    .where(
      and(
        eq(sessions.id, principal.sessionId),
        eq(sessions.userId, principal.id),
        eq(sessions.securityLevel, 'mfa'),
      ),
    )
    .returning({ id: sessions.id });

  if (!refreshedSession) {
    throw new AuthorizationDeniedError('Admin session could not be refreshed.');
  }

  return {
    ...principal,
    sessionLastVerifiedAt: verifiedAt.toISOString(),
  };
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

// Staff = admin or advisor. Admins keep the full MFA bar; advisors authenticate
// with password + device verification (they have no TOTP enrollment).
export async function requireStaffSession() {
  const principal = await requireSession();

  if (principal.role === 'admin') {
    if (
      principal.sessionSecurityLevel !== 'mfa' ||
      !principal.twoFactorEnabled
    ) {
      throw new AuthorizationDeniedError('Admin MFA is required.');
    }
    return principal;
  }

  if (principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }

  return principal;
}

export async function requireCriticalStaff(password: string) {
  const principal = await requireStaffSession();

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

  const storedHash = credential?.password;
  const passwordValid =
    Boolean(storedHash) &&
    (await verifyPassword({ hash: storedHash as string, password }));

  if (!passwordValid) {
    // Only failed confirmations consume the rate limit, so legitimate repeated
    // critical actions are never locked out while brute-force stays bounded.
    const limit = await consumeRateLimit(
      `critical-staff:${principal.id}`,
      5,
      15 * 60 * 1000,
    );

    if (!limit.allowed) {
      throw new AuthorizationDeniedError(
        'Critical action rate limit exceeded.',
      );
    }

    throw new AuthorizationDeniedError('Password confirmation failed.');
  }

  const verifiedAt = new Date();
  const sessionConditions = [
    eq(sessions.id, principal.sessionId),
    eq(sessions.userId, principal.id),
  ];
  if (principal.role === 'admin') {
    sessionConditions.push(eq(sessions.securityLevel, 'mfa'));
  }
  const [refreshedSession] = await database
    .update(sessions)
    .set({
      lastVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    .where(and(...sessionConditions))
    .returning({ id: sessions.id });

  if (!refreshedSession) {
    throw new AuthorizationDeniedError('Staff session could not be refreshed.');
  }

  return {
    ...principal,
    sessionLastVerifiedAt: verifiedAt.toISOString(),
  };
}

export async function requireFreshStudentPassword(
  password: string,
  action: string,
  ip?: string,
) {
  const principal = await requireFreshSession();

  // Google identity linking is available to both students and teachers (the
  // teacher's Google account drives Meet attendance matching).
  if (principal.role !== 'student' && principal.role !== 'teacher') {
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

  // Trial (discovery-lesson) accounts stop working past their demo window.
  if (role === 'student') {
    const [profile] = await database
      .select({ demoExpiresAt: studentProfiles.demoExpiresAt })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, principal.id))
      .limit(1);
    if (
      profile?.demoExpiresAt &&
      profile.demoExpiresAt.getTime() < Date.now()
    ) {
      redirect(`/${locale}/yetkisiz`);
    }
  }

  return principal;
}
