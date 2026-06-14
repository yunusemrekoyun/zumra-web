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
import {
  setPrivateLessonStudentRate,
  supportedProgramLanguages,
} from '@/lib/server/services/programs';

const rateSchema = z.object({
  hourlyPriceCents: z.number().int().positive(),
  language: z.enum(supportedProgramLanguages),
  teacherUserId: z.string().min(1).max(160),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = rateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const rate = await setPrivateLessonStudentRate(principal, parsed.data);
    await auditService.record({
      action: 'private_lesson_student_rate.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: rate?.id,
      targetType: 'private_lesson_student_rate',
    });
    return apiResponse(rate ?? {}, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
