import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { admin, twoFactor, username } from 'better-auth/plugins';
import { database } from '@/lib/server/db/client';
import * as schema from '@/lib/server/db/schema';
import { cookiesAreSecure, getAuthEnv } from '@/lib/server/env';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import {
  googleAccountSecurityPolicy,
  googleProviderSecurityPolicy,
} from '@/lib/server/security/google-identity-policy';
import { isValidDeviceCookie } from '@/lib/server/security/device-cookie';
import { hashToken } from '@/lib/server/security/tokens';
import { retireOtherPendingDeviceSessions } from '@/lib/server/services/devices';
import { notificationService } from '@/lib/server/services/notifications';

const env = getAuthEnv();
const googleAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

async function isTrustedDevice(userId: string, request?: Request) {
  const cookie = request?.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)(?:__Host-)?zumra\.device=([^;]+)/);
  const deviceToken = match?.[1] ? decodeURIComponent(match[1]) : undefined;

  if (!deviceToken) {
    return false;
  }

  if (!isValidDeviceCookie(deviceToken)) {
    return false;
  }

  const [device] = await database
    .select({ id: schema.trustedDevices.id })
    .from(schema.trustedDevices)
    .where(
      and(
        eq(schema.trustedDevices.userId, userId),
        eq(schema.trustedDevices.deviceIdHash, hashToken(deviceToken)),
        gt(schema.trustedDevices.expiresAt, new Date()),
        isNull(schema.trustedDevices.revokedAt),
      ),
    )
    .limit(1);

  return Boolean(device);
}

export const auth = betterAuth({
  appName: 'Zümra Akademi',
  basePath: '/api/auth',
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(database, {
    provider: 'pg',
    schema,
    transaction: true,
    usePlural: true,
  }),
  secret: env.BETTER_AUTH_SECRET,
  logger: {
    disabled: env.NODE_ENV === 'production',
  },
  telemetry: {
    enabled: false,
  },
  emailAndPassword: {
    autoSignIn: false,
    disableSignUp: true,
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 12,
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      const callbackUrl = new URL(url).searchParams.get('callbackURL') ?? '';
      const locale = /\/en(?:\/|$)/.test(callbackUrl) ? 'en' : 'tr';
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `password-reset:${user.id}:${hashToken(url)}`,
        locale,
        payload: { name: user.name },
        recipient: user.email,
        sensitivePayload: { resetUrl: url },
        templateKey: 'password-reset',
      });
    },
  },
  account: {
    accountLinking: googleAccountSecurityPolicy,
    encryptOAuthTokens: true,
    storeStateStrategy: 'database',
  },
  socialProviders: googleAuthConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          ...googleProviderSecurityPolicy,
        },
      }
    : {},
  user: {
    additionalFields: {
      accountStatus: {
        defaultValue: 'pending',
        input: false,
        required: true,
        type: 'string',
      },
    },
    changeEmail: {
      enabled: false,
    },
    deleteUser: {
      enabled: false,
    },
  },
  session: {
    additionalFields: {
      deviceId: {
        input: false,
        required: false,
        type: 'string',
      },
      lastVerifiedAt: {
        input: false,
        required: false,
        type: 'date',
      },
      securityLevel: {
        defaultValue: 'pending',
        input: false,
        required: true,
        type: 'string',
      },
    },
    cookieCache: {
      enabled: false,
      maxAge: 60,
      strategy: 'jwe',
    },
    expiresIn: 14 * 24 * 60 * 60,
    freshAge: 15 * 60,
    storeSessionInDatabase: true,
    updateAge: 24 * 60 * 60,
  },
  plugins: [
    username({
      displayUsernameNormalization: (value) => value.trim(),
      maxUsernameLength: 30,
      minUsernameLength: 5,
      usernameNormalization: (value) =>
        value.trim().toLocaleLowerCase('en-US'),
      usernameValidator: (value) =>
        /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(value),
    }),
    admin({
      adminRoles: ['admin'],
      defaultRole: 'student',
      impersonationSessionDuration: 15 * 60,
    }),
    twoFactor({
      issuer: 'Zümra Akademi',
      trustDeviceMaxAge: 0,
      twoFactorCookieMaxAge: 10 * 60,
    }),
  ],
  rateLimit: {
    customRules: {
      '/request-password-reset': {
        max: 3,
        window: 15 * 60,
      },
      '/reset-password': {
        max: 5,
        window: 15 * 60,
      },
      '/sign-in/username': {
        max: 8,
        window: 60,
      },
    },
    enabled: true,
    max: 100,
    storage: 'memory',
    window: 60,
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path === '/sign-in/username') {
        const rawUsername = (context.body as { username?: unknown } | undefined)
          ?.username;
        if (typeof rawUsername === 'string' && rawUsername.trim().length > 0) {
          // Account-level brute-force lockout, keyed by the normalized
          // username and shared across replicas via Redis. Complements Better
          // Auth's per-IP limit (which is per-instance/in-memory) by also
          // capping distributed attempts against a single account. Fail-open
          // if Redis is unavailable so a cache outage cannot lock everyone out.
          const normalized = rawUsername.trim().toLocaleLowerCase('en-US');
          const lock = await consumeRateLimit(
            `login-account:${normalized}`,
            20,
            15 * 60 * 1000,
          ).catch(() => ({ allowed: true }));
          if (!lock.allowed) {
            throw new APIError('TOO_MANY_REQUESTS', {
              code: 'RATE_LIMITED',
              message: 'Too many login attempts. Please try again later.',
            });
          }
        }
        return;
      }

      if (context.path !== '/reset-password') {
        return;
      }

      const body = context.body as
        | { newPassword?: string; token?: string }
        | undefined;
      const token = body?.token ?? context.query?.token;

      if (!token || !body?.newPassword) {
        return;
      }

      const verification =
        await context.context.internalAdapter.findVerificationValue(
          `reset-password:${token}`,
        );

      if (!verification || verification.expiresAt < new Date()) {
        return;
      }

      const credential = (
        await context.context.internalAdapter.findAccounts(verification.value)
      ).find((account) => account.providerId === 'credential');

      if (
        credential?.password &&
        (await context.context.password.verify({
          hash: credential.password,
          password: body.newPassword,
        }))
      ) {
        throw new APIError('BAD_REQUEST', {
          code: 'PASSWORD_SAME_AS_CURRENT',
          message: 'The new password must be different from the current password.',
        });
      }
    }),
  },
  advanced: {
    cookiePrefix: 'zumra',
    database: {
      // PostgreSQL's native UUID mode expects UUID columns with database
      // defaults. Our auth IDs are stored as text, so generate UUID strings
      // in the application and always pass them to Drizzle explicitly.
      generateId: () => randomUUID(),
    },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookiesAreSecure(),
    },
    ipAddress: {
      ipAddressHeaders: ['x-real-ip'],
    },
    useSecureCookies: cookiesAreSecure(),
  },
  databaseHooks: {
    account: {
      create: {
        async before(account) {
          if (account.providerId !== 'google') {
            return;
          }

          const [user] = await database
            .select({
              accountStatus: schema.users.accountStatus,
              emailVerified: schema.users.emailVerified,
              role: schema.users.role,
            })
            .from(schema.users)
            .where(eq(schema.users.id, account.userId))
            .limit(1);

          return Boolean(
            user?.role === 'student' &&
              user.accountStatus === 'active' &&
              user.emailVerified,
          );
        },
      },
      delete: {
        async after(account) {
          if (account.providerId !== 'google') {
            return;
          }

          await database
            .delete(schema.externalIdentities)
            .where(
              and(
                eq(schema.externalIdentities.userId, account.userId),
                eq(schema.externalIdentities.provider, 'google'),
              ),
            );
        },
      },
    },
    session: {
      create: {
        async before(session, context) {
          const [user] = await database
            .select({
              accountStatus: schema.users.accountStatus,
              role: schema.users.role,
              twoFactorEnabled: schema.users.twoFactorEnabled,
            })
            .from(schema.users)
            .where(eq(schema.users.id, session.userId))
            .limit(1);

          if (!user) {
            return false;
          }

          if (user.accountStatus !== 'active') {
            return false;
          }

          const isGoogleCallback =
            context?.path === '/callback/google' ||
            context?.request?.url.includes('/callback/google');

          if (isGoogleCallback && user.role !== 'student') {
            return false;
          }

          if (user.role === 'admin') {
            // Demo-only: DEMO_TRUST_DEVICES also clears the admin MFA wall so
            // the demo admin can sign in with just a password (no authenticator).
            const adminVerified =
              env.DEMO_TRUST_DEVICES || user.twoFactorEnabled;
            return {
              data: {
                ...session,
                lastVerifiedAt: adminVerified ? new Date() : undefined,
                securityLevel: adminVerified ? 'mfa' : 'pending',
              },
            };
          }

          const trusted =
            env.DEMO_TRUST_DEVICES ||
            (await isTrustedDevice(session.userId, context?.request));

          return {
            data: {
              ...session,
              lastVerifiedAt: trusted ? new Date() : undefined,
              securityLevel: trusted ? 'standard' : 'pending',
            },
          };
        },
        async after(session) {
          await retireOtherPendingDeviceSessions({
            currentSessionId: session.id,
            userId: session.userId,
          });
        },
      },
    },
  },
  trustedOrigins: [env.APP_URL, env.APP_URL.replace('://', '://www.')],
});
