import 'server-only';

import type { NextResponse } from 'next/server';
import { cookiesAreSecure } from '@/lib/server/env';

const PRODUCTION_COOKIE = '__Host-zumra.assessment';
const DEVELOPMENT_COOKIE = 'zumra.assessment';

export function publicAssessmentCookieName() {
  return cookiesAreSecure() ? PRODUCTION_COOKIE : DEVELOPMENT_COOKIE;
}

export function setPublicAssessmentCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set(publicAssessmentCookieName(), token, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: cookiesAreSecure(),
  });
}

export function clearPublicAssessmentCookie(response: NextResponse) {
  response.cookies.set(publicAssessmentCookieName(), '', {
    expires: new Date(0),
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: cookiesAreSecure(),
  });
}
