import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { getLessonMeetingJoinUrl } from '@/lib/server/services/lesson-meetings';

export const runtime = 'nodejs';

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
    return apiErrorResponse(error, id);
  }
}
