import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { auditService } from '@/lib/server/services/audit';
import {
  createPrivateLessons,
  PrivateLessonConflictError,
} from '@/lib/server/services/lesson-schedules';

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

const inputSchema = z.object({
  enrollmentId: z.string().uuid(),
  slots: z.array(slotSchema).min(1).max(30),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const result = await createPrivateLessons(principal, parsed.data);

    await auditService.record({
      action: 'lesson.private_created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: {
        enrollmentId: parsed.data.enrollmentId,
        count: result.lessonSessionIds.length,
      },
      requestId: id,
      result: 'success',
      targetType: 'enrollment',
      targetId: parsed.data.enrollmentId,
    });

    return apiResponse(
      { lessonSessionIds: result.lessonSessionIds },
      201,
      id,
    );
  } catch (error) {
    if (error instanceof PrivateLessonConflictError) {
      return apiResponse(
        { error: 'conflict', conflicts: error.conflicts },
        409,
        id,
      );
    }
    return apiErrorResponse(error, id);
  }
}
