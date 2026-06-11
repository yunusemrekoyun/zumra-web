import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { isGoogleAuthConfigured } from '@/lib/server/env';
import { requestId } from '@/lib/server/http/api-errors';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import { requestIp } from '@/lib/server/security/network';
import { hashToken } from '@/lib/server/security/tokens';
import { normalizeUsername } from '@/lib/server/security/username';
import {
  isBlockedExternalAuthPath,
  isTwoFactorDisablePath,
} from '@/lib/server/security/auth-path-policy';
import { auditService } from '@/lib/server/services/audit';

export const runtime = 'nodejs';

const handlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  const pathname = new URL(request.url).pathname;

  if (isBlockedExternalAuthPath(pathname)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const response = await handlers.GET(request);

  if (
    pathname.endsWith('/callback/google') &&
    isGoogleFailureRedirect(response.headers.get('location'))
  ) {
    await auditService
      .record({
        action: 'google_identity.sign_in_failed',
        ip: requestIp(request.headers),
        requestId: requestId(request),
        result: 'failed',
        targetType: 'external_identity',
      })
      .catch(() => undefined);
  }

  return response;
}

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;

  if (isBlockedExternalAuthPath(pathname)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (isTwoFactorDisablePath(pathname)) {
    const session = await auth.api.getSession({ headers: request.headers });
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (role === 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  if (pathname.endsWith('/sign-in/username')) {
    const payload = (await request.clone().json().catch(() => ({}))) as {
      username?: string;
    };
    const username = normalizeUsername(payload.username ?? 'unknown');
    const ip = requestIp(request.headers) ?? 'unknown';
    const [globalLimit, accountLimit] = await Promise.all([
      consumeRateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000),
      consumeRateLimit(
        `login-user-ip:${hashToken(username)}:${ip}`,
        8,
        15 * 60 * 1000,
      ),
    ]);

    if (!globalLimit.allowed || !accountLimit.allowed) {
      return NextResponse.json(
        { message: 'Sign in could not be completed.' },
        { status: 429 },
      );
    }
  }

  if (pathname.endsWith('/sign-in/social')) {
    const payload = (await request.clone().json().catch(() => ({}))) as {
      provider?: string;
    };

    if (payload.provider !== 'google' || !isGoogleAuthConfigured()) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const ip = requestIp(request.headers) ?? 'unknown';
    const limit = await consumeRateLimit(
      `google-sign-in-ip:${ip}`,
      10,
      15 * 60 * 1000,
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { message: 'Sign in could not be completed.' },
        { status: 429 },
      );
    }
  }

  if (pathname.endsWith('/request-password-reset')) {
    const payload = (await request.clone().json().catch(() => ({}))) as {
      email?: string;
    };
    const ip = requestIp(request.headers) ?? 'unknown';
    const emailKey = hashToken(
      (payload.email ?? 'unknown').trim().toLocaleLowerCase('en-US'),
    );
    const [ipLimit, accountLimit] = await Promise.all([
      consumeRateLimit(`password-reset-request-ip:${ip}`, 6, 15 * 60 * 1000),
      consumeRateLimit(
        `password-reset-request:${emailKey}:${ip}`,
        3,
        15 * 60 * 1000,
      ),
    ]);

    if (!ipLimit.allowed || !accountLimit.allowed) {
      return genericRateLimitResponse();
    }
  }

  if (pathname.endsWith('/reset-password')) {
    const payload = (await request.clone().json().catch(() => ({}))) as {
      token?: string;
    };
    const ip = requestIp(request.headers) ?? 'unknown';
    const [ipLimit, tokenLimit] = await Promise.all([
      consumeRateLimit(`password-reset-ip:${ip}`, 10, 15 * 60 * 1000),
      consumeRateLimit(
        `password-reset-token:${hashToken(payload.token ?? 'unknown')}:${ip}`,
        5,
        15 * 60 * 1000,
      ),
    ]);

    if (!ipLimit.allowed || !tokenLimit.allowed) {
      return genericRateLimitResponse();
    }
  }

  if (
    pathname.endsWith('/two-factor/verify-totp') ||
    pathname.endsWith('/two-factor/verify-backup-code') ||
    pathname.endsWith('/two-factor/enable')
  ) {
    const ip = requestIp(request.headers) ?? 'unknown';
    const session = await auth.api.getSession({ headers: request.headers });
    const identity = session?.user.id ?? 'pending';
    const [ipLimit, identityLimit] = await Promise.all([
      consumeRateLimit(`mfa-ip:${ip}`, 20, 15 * 60 * 1000),
      consumeRateLimit(`mfa:${identity}:${ip}`, 8, 15 * 60 * 1000),
    ]);

    if (!ipLimit.allowed || !identityLimit.allowed) {
      return genericRateLimitResponse();
    }
  }

  const response = await handlers.POST(request);

  if (pathname.endsWith('/sign-in/social') && response.status >= 400) {
    await auditService
      .record({
        action: 'google_identity.sign_in_failed',
        ip: requestIp(request.headers),
        requestId: requestId(request),
        result: 'failed',
        targetType: 'external_identity',
      })
      .catch(() => undefined);
  }

  return response;
}

function genericRateLimitResponse() {
  return NextResponse.json(
    { message: 'Authentication could not be completed.' },
    { status: 429 },
  );
}

function isGoogleFailureRedirect(location: string | null) {
  if (!location) {
    return false;
  }

  try {
    const url = new URL(location, 'http://local.invalid');
    return (
      url.searchParams.get('google') === 'error' ||
      url.searchParams.has('error')
    );
  } catch {
    return false;
  }
}
