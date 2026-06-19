import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  confirmLessonAttendance,
  getLessonAttendanceDraft,
} from '@/lib/server/services/lesson-meetings';

const attendanceStatusSchema = z.enum([
  'absent',
  'excused',
  'late',
  'needs_review',
  'present',
]);

const confirmInputSchema = z.object({
  records: z
    .array(
      z.object({
        status: attendanceStatusSchema,
        studentProfileId: z.string().uuid(),
        teacherNote: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(250),
});

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
    const attendance = await getLessonAttendanceDraft(
      principal,
      lessonSessionId,
    );

    return apiResponse({ attendance }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

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

    const parsed = confirmInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const attendance = await confirmLessonAttendance(
      principal,
      lessonSessionId,
      parsed.data,
    );

    return apiResponse({ attendance }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
