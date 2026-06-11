import 'server-only';

import { and, eq } from 'drizzle-orm';
import type {
  GoogleIdentityService,
  GoogleIdentitySummary,
} from '@/lib/domain';
import { auth } from '@/lib/server/auth';
import { requireFreshStudentPassword } from '@/lib/server/authorization';
import { database } from '@/lib/server/db/client';
import {
  accounts,
  externalIdentities,
  users,
} from '@/lib/server/db/schema';
import { getAuthEnv, isGoogleAuthConfigured } from '@/lib/server/env';
import {
  AuthorizationDeniedError,
  ExternalIdentityError,
} from '@/lib/server/http/errors';
import {
  GoogleProfileValidationError,
  type VerifiedGoogleProfile,
  validateGoogleProfileForStudent,
} from '@/lib/server/security/google-profile';

export class GoogleIdentityError extends ExternalIdentityError {
  constructor(message = 'Google identity operation could not be completed.') {
    super(message);
    this.name = 'GoogleIdentityError';
  }
}

export const googleIdentityService: GoogleIdentityService = {
  async getStatus(studentId) {
    if (!isGoogleAuthConfigured()) {
      return {
        configured: false,
        linked: false,
      };
    }

    const [[googleAccount], [identity]] = await Promise.all([
      database
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, studentId),
            eq(accounts.providerId, 'google'),
          ),
        )
        .limit(1),
      database
        .select({
          avatarUrl: externalIdentities.avatarUrl,
          displayName: externalIdentities.displayName,
          providerLocale: externalIdentities.providerLocale,
          verifiedEmail: externalIdentities.verifiedEmail,
        })
        .from(externalIdentities)
        .where(
          and(
            eq(externalIdentities.userId, studentId),
            eq(externalIdentities.provider, 'google'),
          ),
        )
        .limit(1),
    ]);

    return {
      configured: true,
      identity: identity
        ? toIdentitySummary({
            ...identity,
            provider: 'google',
          })
        : undefined,
      linked: Boolean(googleAccount),
    };
  },

  async beginLink(student, password, locale, headers) {
    assertGoogleAvailable();
    const confirmed = await requireFreshStudentPassword(
      password,
      'google-link',
      headers.get('x-real-ip') ?? undefined,
    );

    if (confirmed.id !== student.id) {
      throw new AuthorizationDeniedError('Student session changed.');
    }

    const status = await this.getStatus(student.id);

    if (status.linked) {
      throw new GoogleIdentityError();
    }

    const env = getAuthEnv();
    const result = await auth.api.linkSocialAccount({
      body: {
        callbackURL: `${env.APP_URL}/${locale}/google-tamamla?mode=link`,
        disableRedirect: true,
        errorCallbackURL: `${env.APP_URL}/${locale}/ogrenci/profil?google=error`,
        provider: 'google',
      },
      headers,
      returnHeaders: true,
    });

    if (!result.response.url) {
      throw new GoogleIdentityError();
    }

    return {
      setCookies: getSetCookieHeaders(result.headers),
      url: result.response.url,
    };
  },

  async syncLinkedIdentity(studentId, headers, mode) {
    assertGoogleAvailable();
    const student = await getEligibleStudent(studentId);
    const [googleAccount] = await database
      .select({
        accountId: accounts.accountId,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, studentId),
          eq(accounts.providerId, 'google'),
        ),
      )
      .limit(1);

    if (!googleAccount) {
      throw new GoogleIdentityError();
    }

    try {
      const tokens = await auth.api.getAccessToken({
        body: {
          accountId: googleAccount.accountId,
          providerId: 'google',
        },
        headers,
      });

      if (!tokens.accessToken) {
        throw new GoogleIdentityError();
      }

      const response = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: {
            authorization: `Bearer ${tokens.accessToken}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) {
        throw new GoogleIdentityError();
      }

      const profile = validateGoogleProfileForStudent(
        await response.json(),
        student.email,
      );

      if (profile.sub !== googleAccount.accountId) {
        throw new GoogleIdentityError();
      }

      const now = new Date();
      await database
        .insert(externalIdentities)
        .values(identityValues(studentId, profile, mode, now))
        .onConflictDoUpdate({
          target: [
            externalIdentities.userId,
            externalIdentities.provider,
          ],
          set: {
            avatarUrl: profile.picture,
            displayName: profile.name,
            familyName: profile.family_name,
            givenName: profile.given_name,
            lastSignInAt: mode === 'signin' ? now : undefined,
            lastSyncedAt: now,
            providerAccountId: profile.sub,
            providerLocale: profile.locale,
            updatedAt: now,
            verifiedEmail: profile.email,
          },
        });

      if (mode === 'link') {
        await auth.api.revokeOtherSessions({ headers });
      }

      return toIdentitySummary({
        avatarUrl: profile.picture,
        displayName: profile.name,
        provider: 'google',
        providerLocale: profile.locale,
        verifiedEmail: profile.email,
      });
    } catch (error) {
      if (mode === 'link') {
        await removeGoogleIdentity(studentId).catch(() => undefined);
      }

      if (
        error instanceof GoogleIdentityError ||
        error instanceof GoogleProfileValidationError
      ) {
        throw error;
      }

      throw new GoogleIdentityError();
    }
  },

  async unlink(student, password, headers) {
    assertGoogleAvailable();
    const confirmed = await requireFreshStudentPassword(
      password,
      'google-unlink',
      headers.get('x-real-ip') ?? undefined,
    );

    if (confirmed.id !== student.id) {
      throw new AuthorizationDeniedError('Student session changed.');
    }

    const [googleAccount] = await database
      .select({ accountId: accounts.accountId })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, student.id),
          eq(accounts.providerId, 'google'),
        ),
      )
      .limit(1);

    if (!googleAccount) {
      throw new GoogleIdentityError();
    }

    await auth.api.unlinkAccount({
      body: {
        accountId: googleAccount.accountId,
        providerId: 'google',
      },
      headers,
    });
    await database
      .delete(externalIdentities)
      .where(
        and(
          eq(externalIdentities.userId, student.id),
          eq(externalIdentities.provider, 'google'),
        ),
      );
    await auth.api.revokeOtherSessions({ headers });
  },
};

async function getEligibleStudent(studentId: string) {
  const [student] = await database
    .select({
      accountStatus: users.accountStatus,
      email: users.email,
      emailVerified: users.emailVerified,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);

  if (
    !student ||
    student.role !== 'student' ||
    student.accountStatus !== 'active' ||
    !student.emailVerified
  ) {
    throw new GoogleIdentityError();
  }

  return student;
}

function assertGoogleAvailable() {
  if (!isGoogleAuthConfigured()) {
    throw new GoogleIdentityError('Google identity is not configured.');
  }
}

function identityValues(
  studentId: string,
  profile: VerifiedGoogleProfile,
  mode: 'link' | 'signin',
  now: Date,
) {
  return {
    avatarUrl: profile.picture,
    displayName: profile.name,
    familyName: profile.family_name,
    givenName: profile.given_name,
    lastSignInAt: mode === 'signin' ? now : undefined,
    lastSyncedAt: now,
    linkedAt: now,
    provider: 'google' as const,
    providerAccountId: profile.sub,
    providerLocale: profile.locale,
    updatedAt: now,
    userId: studentId,
    verifiedEmail: profile.email,
  };
}

function toIdentitySummary(
  identity: {
    avatarUrl?: string | null;
    displayName: string;
    provider: 'google';
    providerLocale?: string | null;
    verifiedEmail: string;
  },
): GoogleIdentitySummary {
  return {
    avatarUrl: identity.avatarUrl ?? undefined,
    displayName: identity.displayName,
    provider: 'google',
    providerLocale: identity.providerLocale ?? undefined,
    verifiedEmail: identity.verifiedEmail,
  };
}

async function removeGoogleIdentity(studentId: string) {
  await database.transaction(async (transaction) => {
    await transaction
      .delete(externalIdentities)
      .where(
        and(
          eq(externalIdentities.userId, studentId),
          eq(externalIdentities.provider, 'google'),
        ),
      );
    await transaction
      .delete(accounts)
      .where(
        and(
          eq(accounts.userId, studentId),
          eq(accounts.providerId, 'google'),
        ),
      );
  });
}

function getSetCookieHeaders(headers: Headers) {
  const cookies =
    'getSetCookie' in headers &&
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [];

  if (cookies.length > 0) {
    return cookies;
  }

  const fallback = headers.get('set-cookie');
  return fallback ? [fallback] : [];
}
