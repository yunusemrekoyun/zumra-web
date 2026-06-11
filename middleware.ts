import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);
const protectedRoots = new Set(['admin', 'ogrenci', 'danisman', 'ogretmen']);

export default function middleware(request: NextRequest) {
  if (process.env.AUTH_ENFORCEMENT_ENABLED === 'true') {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean);
    const locale = routing.locales.includes(segments[0] as 'tr' | 'en')
      ? segments[0]
      : routing.defaultLocale;
    const root = segments[1];
    const hasSessionCookie = request.cookies
      .getAll()
      .some(({ name }) => name.endsWith('zumra.session_token'));

    if (root && protectedRoots.has(root) && !hasSessionCookie) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/giris`;
      loginUrl.search = '';
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = intlMiddleware(request);
  const suppliedRequestId = request.headers.get('x-request-id')?.trim();
  response.headers.set(
    'x-request-id',
    suppliedRequestId && /^[a-zA-Z0-9._:-]{1,64}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : crypto.randomUUID(),
  );
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
