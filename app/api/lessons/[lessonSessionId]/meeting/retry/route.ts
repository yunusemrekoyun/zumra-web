import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { retryLessonMeetingCreation } from '@/lib/server/services/lesson-meetings';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonSessionId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { lessonSessionId } = await params;
    if (!z.string().uuid().safeParse(lessonSessionId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const returnTo = await readReturnTo(request);
    const principal = await requireSession();
    const result = await retryLessonMeetingCreation(
      principal,
      lessonSessionId,
    );

    if (returnTo?.startsWith('/')) {
      const redirectUrl = new URL(returnTo, request.url);
      redirectUrl.searchParams.set('meeting', 'retry');
      return NextResponse.redirect(redirectUrl, {
        headers: { 'X-Request-ID': id },
        status: 303,
      });
    }

    return apiResponse(result, 202, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

async function readReturnTo(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return undefined;
  }

  const form = await request.formData().catch(() => null);
  const value = form?.get('returnTo');
  return typeof value === 'string' ? value : undefined;
}
