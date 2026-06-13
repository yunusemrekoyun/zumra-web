import 'dotenv/config';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canAuthorizeWorkspaceAction,
  getAuthenticatedDestination,
  type WorkspacePrincipal,
} from '@/lib/domain';
import {
  createNumericOtp,
  createOpaqueToken,
  safeTokenEqual,
} from '@/lib/server/security/tokens';
import {
  isValidUsername,
  normalizeUsername,
} from '@/lib/server/security/username';
import { maskIp, redactMetadata } from '@/lib/server/security/network';
import {
  apiErrorResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  AuthorizationDeniedError,
  PayloadTooLargeError,
} from '@/lib/server/http/errors';
import { mediaAuthorizationService } from '@/lib/server/services/media-authorization';
import {
  isBlockedExternalAuthPath,
  isTwoFactorDisablePath,
} from '@/lib/server/security/auth-path-policy';
import {
  canManageGoogleIdentity,
  googleAccountSecurityPolicy,
  googleOAuthScopes,
  googleProviderSecurityPolicy,
} from '@/lib/server/security/google-identity-policy';
import { validateGoogleProfileForStudent } from '@/lib/server/security/google-profile';
import {
  isValidIdentityDocument,
  maskIdentityDocument,
  normalizeIdentityDocument,
  protectIdentityDocument,
} from '@/lib/server/security/identity';

function principal(
  overrides: Partial<WorkspacePrincipal> = {},
): WorkspacePrincipal {
  return {
    accountStatus: 'active',
    email: 'user@example.com',
    id: 'user-1',
    name: 'User',
    role: 'student',
    sessionCreatedAt: new Date().toISOString(),
    sessionId: 'session-1',
    sessionLastVerifiedAt: new Date().toISOString(),
    sessionSecurityLevel: 'standard',
    twoFactorEnabled: false,
    ...overrides,
  };
}

describe('security foundation', () => {
  it('keeps every workspace page behind a page-level role guard', async () => {
    const roots = ['admin', 'ogrenci', 'danisman', 'ogretmen'].map((scope) =>
      path.join(process.cwd(), 'app', '[locale]', scope),
    );
    const pageFiles = (
      await Promise.all(roots.map((root) => findPageFiles(root)))
    ).flat();
    const unguarded = [];

    for (const pageFile of pageFiles) {
      const source = await readFile(pageFile, 'utf8');

      if (
        !source.includes('withWorkspacePage(') &&
        !source.includes('requireWorkspaceRole(')
      ) {
        unguarded.push(path.relative(process.cwd(), pageFile));
      }
    }

    expect(unguarded).toEqual([]);
  });

  it('creates opaque single-use token material without storing plaintext', () => {
    const created = createOpaqueToken();
    expect(created.token).not.toBe(created.hash);
    expect(created.hash).toHaveLength(64);
    expect(safeTokenEqual(created.token, created.hash)).toBe(true);
    expect(safeTokenEqual(`${created.token}x`, created.hash)).toBe(false);
  });

  it('creates fixed-width numeric OTPs without weak fallback randomness', () => {
    expect(createNumericOtp()).toMatch(/^\d{6}$/);
    expect(createNumericOtp(9)).toMatch(/^\d{9}$/);
    expect(() => createNumericOtp(0)).toThrow();
    expect(() => createNumericOtp(10)).toThrow();
  });

  it('redacts nested sensitive audit metadata and sanitizes request IDs', () => {
    expect(
      redactMetadata({
        nested: {
          Authorization: 'Bearer secret',
          profile: { name: 'Student' },
        },
        password: 'plain-text',
      }),
    ).toEqual({
      nested: {
        Authorization: '[REDACTED]',
        profile: { name: 'Student' },
      },
      password: '[REDACTED]',
    });

    expect(
      requestId(
        new Request('http://localhost', {
          headers: { 'x-request-id': 'valid-request_123' },
        }),
      ),
    ).toBe('valid-request_123');
    expect(
      requestId(
        new Request('http://localhost', {
          headers: { 'x-request-id': 'x'.repeat(100) },
        }),
      ),
    ).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('maps media authorization and stream limits to safe HTTP responses', async () => {
    const forbidden = apiErrorResponse(
      new AuthorizationDeniedError(),
      'request-1',
    );
    const oversized = apiErrorResponse(
      new PayloadTooLargeError(),
      'request-2',
    );

    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: 'forbidden' });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ error: 'payload_too_large' });
  });

  it('normalizes and validates usernames consistently', () => {
    expect(normalizeUsername('  Yunus.Emre  ')).toBe('yunus.emre');
    expect(isValidUsername('yunus_emre')).toBe(true);
    expect(isValidUsername('x')).toBe(false);
    expect(isValidUsername('../admin')).toBe(false);
  });

  it('validates, encrypts and masks identity documents without plaintext storage', () => {
    expect(
      isValidIdentityDocument('national_id', '10000000146'),
    ).toBe(true);
    expect(isValidIdentityDocument('national_id', '10000000147')).toBe(false);
    expect(normalizeIdentityDocument('passport', ' tr-123 456 ')).toBe(
      'TR123456',
    );

    const protectedPassport = protectIdentityDocument(
      'passport',
      'TR123456',
    );
    expect(protectedPassport.encrypted).not.toContain('TR123456');
    expect(protectedPassport.blindIndex).toHaveLength(64);
    expect(maskIdentityDocument('passport', protectedPassport.lastFour)).toBe(
      '****3456',
    );
  });

  it('masks valid IPv4 and compressed IPv6 addresses as network prefixes', () => {
    expect(maskIp('192.168.10.42')).toBe('192.168.10.0/24');
    expect(maskIp('::1')).toBe('::/48');
    expect(maskIp('2001:db8:abcd:1234::1')).toBe('2001:db8:abcd::/48');
    expect(maskIp('fe80::1%lo0')).toBe('fe80::/48');
    expect(maskIp('not-an-ip')).toBe('masked');
  });

  it('requires MFA for admin authorization', () => {
    expect(
      canAuthorizeWorkspaceAction(
        principal({ role: 'admin', sessionSecurityLevel: 'standard' }),
        'student.read',
      ),
    ).toBe(false);
    expect(
      canAuthorizeWorkspaceAction(
        principal({
          role: 'admin',
          sessionSecurityLevel: 'mfa',
          twoFactorEnabled: true,
        }),
        'student.read',
      ),
    ).toBe(true);
  });

  it('routes authenticated users away from the login page safely', () => {
    expect(
      getAuthenticatedDestination(
        principal({
          role: 'admin',
          sessionSecurityLevel: 'mfa',
          twoFactorEnabled: true,
        }),
      ),
    ).toBe('/admin');
    expect(
      getAuthenticatedDestination(
        principal({
          role: 'admin',
          sessionSecurityLevel: 'pending',
          twoFactorEnabled: false,
        }),
      ),
    ).toBe('/mfa-kurulum');
    expect(
      getAuthenticatedDestination(
        principal({ sessionSecurityLevel: 'pending' }),
      ),
    ).toBeNull();
    expect(
      getAuthenticatedDestination(principal({ role: 'advisor' })),
    ).toBe('/danisman');
  });

  it('blocks Better Auth admin management routes from the public catch-all', () => {
    expect(isBlockedExternalAuthPath('/api/auth/admin/create-user')).toBe(true);
    expect(isBlockedExternalAuthPath('/api/auth/admin/set-role')).toBe(true);
    expect(isBlockedExternalAuthPath('/api/auth/get-session')).toBe(false);
    expect(isTwoFactorDisablePath('/api/auth/two-factor/disable')).toBe(true);
  });

  it('keeps Google account management student-only and explicit', () => {
    expect(googleProviderSecurityPolicy).toMatchObject({
      accessType: 'online',
      disableImplicitSignUp: true,
      disableSignUp: true,
    });
    expect(googleAccountSecurityPolicy).toMatchObject({
      allowDifferentEmails: false,
      disableImplicitLinking: true,
      updateUserInfoOnLink: false,
    });
    expect(googleOAuthScopes).toEqual(['openid', 'email', 'profile']);
    expect(canManageGoogleIdentity(principal())).toBe(true);
    expect(canManageGoogleIdentity(principal({ role: 'advisor' }))).toBe(false);
    expect(
      canManageGoogleIdentity(
        principal({ sessionSecurityLevel: 'pending' }),
      ),
    ).toBe(false);

    for (const path of [
      '/api/auth/link-social',
      '/api/auth/unlink-account',
      '/api/auth/list-accounts',
      '/api/auth/get-access-token',
      '/api/auth/refresh-token',
      '/api/auth/account-info',
    ]) {
      expect(isBlockedExternalAuthPath(path)).toBe(true);
    }
  });

  it('accepts only verified Google profiles with the same email address', () => {
    const profile = {
      email: 'student@example.com',
      email_verified: true,
      name: 'Student',
      sub: 'google-subject',
    };

    expect(
      validateGoogleProfileForStudent(profile, 'STUDENT@example.com'),
    ).toMatchObject({ sub: 'google-subject' });
    expect(() =>
      validateGoogleProfileForStudent(
        { ...profile, email: 'other@example.com' },
        'student@example.com',
      ),
    ).toThrow();
    expect(() =>
      validateGoogleProfileForStudent(
        { ...profile, email_verified: false },
        'student@example.com',
      ),
    ).toThrow();
  });

  it('keeps role ownership boundaries', () => {
    expect(
      canAuthorizeWorkspaceAction(
        principal({ role: 'advisor' }),
        'student.read',
        { advisorId: 'user-1' },
      ),
    ).toBe(true);
    expect(
      canAuthorizeWorkspaceAction(
        principal({ role: 'teacher' }),
        'payment.read',
        { teacherId: 'user-1' },
      ),
    ).toBe(false);
    expect(
      canAuthorizeWorkspaceAction(
        principal({ sessionSecurityLevel: 'pending' }),
        'profile.read',
        { ownerUserId: 'user-1' },
      ),
    ).toBe(false);
  });

  it('keeps private media owner/admin access behind verified sessions', async () => {
    const asset = {
      ownerUserId: 'user-1',
      visibility: 'private' as const,
    };

    await expect(
      mediaAuthorizationService.canRead(principal(), asset),
    ).resolves.toBe(true);
    await expect(
      mediaAuthorizationService.canRead(
        principal({ id: 'user-2', role: 'advisor' }),
        asset,
      ),
    ).resolves.toBe(false);
    await expect(
      mediaAuthorizationService.canRead(
        principal({
          role: 'admin',
          sessionSecurityLevel: 'mfa',
          twoFactorEnabled: true,
        }),
        asset,
      ),
    ).resolves.toBe(true);
  });
});

async function findPageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return findPageFiles(entryPath);
      }

      return entry.name === 'page.tsx' ? [entryPath] : [];
    }),
  );

  return nested.flat();
}
