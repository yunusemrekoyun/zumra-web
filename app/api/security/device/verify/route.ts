import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionPrincipal } from '@/lib/server/authorization';
import {
  deviceCookieName,
  isValidDeviceCookie,
} from '@/lib/server/security/device-cookie';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { verifyDeviceChallenge } from '@/lib/server/services/devices';

const requestSchema = z.object({
  challengeId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isTrustedRequestOrigin(request.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const principal = await getSessionPrincipal();

  if (!principal || principal.role === 'admin') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limit = await consumeRateLimit(
    `device-verify:${principal.id}`,
    8,
    15 * 60 * 1000,
  );

  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  const deviceCookie = (await cookies()).get(deviceCookieName())?.value;

  if (!parsed.success || !deviceCookie || !isValidDeviceCookie(deviceCookie)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const requestHeaders = await headers();

  try {
    await verifyDeviceChallenge({
      challengeId: parsed.data.challengeId,
      deviceCookie,
      otp: parsed.data.otp,
      sessionId: principal.sessionId,
      userAgent: requestHeaders.get('user-agent') ?? undefined,
      userId: principal.id,
    });

    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { error: 'invalid_or_expired_code' },
      { status: 400 },
    );
  }
}
