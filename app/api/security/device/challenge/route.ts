import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getSessionPrincipal } from '@/lib/server/authorization';
import { database } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';
import {
  deviceCookieName,
  isValidDeviceCookie,
} from '@/lib/server/security/device-cookie';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  createDeviceChallenge,
  findActiveDeviceChallenge,
} from '@/lib/server/services/devices';

const requestSchema = z.object({
  locale: z.enum(['tr', 'en']).default('tr'),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isTrustedRequestOrigin(request.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const principal = await getSessionPrincipal();

  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (principal.role === 'admin') {
    const [adminUser] = await database
      .select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, principal.id))
      .limit(1);

    return NextResponse.json(
      {
        error: 'admin_mfa_required',
        required: true,
        type: adminUser?.twoFactorEnabled
          ? 'admin_mfa'
          : 'admin_mfa_setup',
      },
      { status: 403 },
    );
  }

  const destinations = {
    advisor: '/danisman',
    student: '/ogrenci',
    teacher: '/ogretmen',
  } as const;

  if (principal.sessionSecurityLevel !== 'pending') {
    return NextResponse.json({
      destination: destinations[principal.role],
      required: false,
    });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  const deviceCookie = (await cookies()).get(deviceCookieName())?.value;

  if (!parsed.success || !deviceCookie || !isValidDeviceCookie(deviceCookie)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const activeChallenge = await findActiveDeviceChallenge({
    sessionId: principal.sessionId,
    userId: principal.id,
  });

  if (activeChallenge) {
    return NextResponse.json({
      ...activeChallenge,
      destination: destinations[principal.role],
      required: true,
    });
  }

  const result = await consumeRateLimit(
    `device-challenge:${principal.id}`,
    3,
    15 * 60 * 1000,
  );

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((result.resetAt - Date.now()) / 1000),
        ),
      },
      { status: 429 },
    );
  }

  const challenge = await createDeviceChallenge({
    deviceCookie,
    email: principal.email,
    locale: parsed.data.locale,
    sessionId: principal.sessionId,
    userId: principal.id,
  });

  return NextResponse.json(
    {
      ...challenge,
      destination: destinations[principal.role],
      required: true,
    },
    { status: 201 },
  );
}
