import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { PublicFlowError } from '@/lib/server/http/errors';
import { getLessonMeetingJoinUrl } from '@/lib/server/services/lesson-meetings';

export const runtime = 'nodejs';

async function resolveLocale(): Promise<string> {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value;
  return cookieLocale === 'en' ? 'en' : 'tr';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonSessionId: string }> },
) {
  const id = requestId(request);

  try {
    const { lessonSessionId } = await params;
    if (!z.string().uuid().safeParse(lessonSessionId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const joinUrl = await getLessonMeetingJoinUrl(principal, lessonSessionId);
    return NextResponse.redirect(joinUrl, {
      headers: { 'X-Request-ID': id },
      status: 302,
    });
  } catch (error) {
    // A student clicks Join in a new tab; on a gating error show a friendly
    // localized page instead of raw JSON.
    if (error instanceof PublicFlowError) {
      const locale = await resolveLocale();
      const redirectTo = new URL(`/${locale}/ders-baglanti`, request.url);
      redirectTo.searchParams.set('reason', error.code);
      return NextResponse.redirect(redirectTo, {
        headers: { 'X-Request-ID': id },
        status: 302,
      });
    }
    return apiErrorResponse(error, id);
  }
}
