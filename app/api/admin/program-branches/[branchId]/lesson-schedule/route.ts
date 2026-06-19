import { z } from 'zod';
import { requireAdminSession } from '@/lib/server/authorization';
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
import { replaceBranchLessonSchedule } from '@/lib/server/services/lesson-schedules';

const lessonSchema = z.object({
  date: z.string().date(),
  startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
});

const inputSchema = z
  .object({
    lessons: z.array(lessonSchema).max(240).optional(),
    repeatWeekly: z.boolean(),
    startTime: z
      .string()
      .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    weekday: z.number().int().min(1).max(7).optional(),
  })
  .superRefine((value, context) => {
    if (value.repeatWeekly && (!value.weekday || !value.startTime)) {
      context.addIssue({
        code: 'custom',
        message: 'weekly_schedule_incomplete',
        path: ['weekday'],
      });
    }
    if (!value.repeatWeekly && !value.lessons?.length) {
      context.addIssue({
        code: 'custom',
        message: 'manual_lessons_required',
        path: ['lessons'],
      });
    }
  });

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { branchId } = await params;
    if (!z.string().uuid().safeParse(branchId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireAdminSession();
    const result = await replaceBranchLessonSchedule(
      principal,
      branchId,
      parsed.data,
    );
    await auditService.record({
      action: 'program_branch.lesson_schedule_replaced',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: {
        repeatWeekly: parsed.data.repeatWeekly,
        sessionCount: result.schedule?.sessionCount ?? 0,
      },
      requestId: id,
      result: 'success',
      targetId: branchId,
      targetType: 'program_branch',
    });

    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
