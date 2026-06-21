import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  createDeviceCookieValue,
  deviceCookieName,
  isValidDeviceCookie,
} from '@/lib/server/security/device-cookie';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { cookiesAreSecure } from '@/lib/server/env';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isTrustedRequestOrigin(request.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const name = deviceCookieName();
  const existing = cookieStore.get(name)?.value;

  if (existing && isValidDeviceCookie(existing)) {
    return NextResponse.json({ ready: true });
  }

  cookieStore.set(name, createDeviceCookieValue(), {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    secure: cookiesAreSecure(),
  });

  return NextResponse.json({ ready: true });
}
