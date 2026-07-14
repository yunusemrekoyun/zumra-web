import { z } from 'zod';
import { requireCriticalStaff } from '@/lib/server/authorization';
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
import { completeEnrollment } from '@/lib/server/services/enrollments';

export const runtime = 'nodejs';

const completeSchema = z.object({
  closeOpenItems: z.boolean().default(false),
  locale: z.enum(['tr', 'en']).default('tr'),
  password: z.string().min(12).max(128),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  const { draftId } = await params;

  try {
    const parsed = completeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }
    const principal = await requireCriticalStaff(parsed.data.password);
    const enrollment = await completeEnrollment(
      principal,
      draftId,
      parsed.data.locale,
      { closeOpenItems: parsed.data.closeOpenItems },
    );
    await auditService.record({
      action: 'candidate.enrollment_completed',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: enrollment?.id,
      targetType: 'enrollment',
    });
    return apiResponse(enrollment ?? {}, 201, id);
  } catch (error) {
    await auditService
      .record({
        action: 'candidate.enrollment_completed',
        ip: requestIp(request.headers),
        requestId: id,
        result: 'failed',
        targetId: draftId,
        targetType: 'enrollment_draft',
      })
      .catch(() => undefined);
    return apiErrorResponse(error, id);
  }
}
