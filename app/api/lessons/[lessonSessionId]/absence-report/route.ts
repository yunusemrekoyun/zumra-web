import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { submitLessonAbsenceReport } from '@/lib/server/services/lesson-meetings';

const inputSchema = z.object({
  note: z.string().max(1000).optional(),
  reason: z.string().max(160).optional(),
  returnTo: z.string().optional(),
});

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

    const parsed = inputSchema.safeParse(await readInput(request));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const report = await submitLessonAbsenceReport(
      principal,
      lessonSessionId,
      parsed.data,
    );

    if (parsed.data.returnTo?.startsWith('/')) {
      const redirectUrl = new URL(parsed.data.returnTo, request.url);
      redirectUrl.searchParams.set('absence', 'reported');
      return NextResponse.redirect(redirectUrl, {
        headers: { 'X-Request-ID': id },
        status: 303,
      });
    }

    return apiResponse({ report, status: 'submitted' }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

async function readInput(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return request.json().catch(() => null);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return null;

  return {
    note: String(form.get('note') ?? ''),
    reason: String(form.get('reason') ?? ''),
    returnTo: String(form.get('returnTo') ?? ''),
  };
}
