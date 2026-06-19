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
  InstructorIdentityConflictError,
  restoreInstructorProfile,
} from '@/lib/server/services/instructors';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ instructorId: string }> },
) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const { instructorId } = await context.params;
    if (!z.string().uuid().safeParse(instructorId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await restoreInstructorProfile(principal, instructorId);
    await auditService.record({
      action: 'instructor.restored',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: instructorId,
      targetType: 'instructor_profile',
    });
    return apiResponse(result, 200, id);
  } catch (error) {
    if (error instanceof InstructorIdentityConflictError) {
      return apiResponse(
        { error: error.code, instructor: error.conflict },
        409,
        id,
      );
    }
    return apiErrorResponse(error, id);
  }
}
