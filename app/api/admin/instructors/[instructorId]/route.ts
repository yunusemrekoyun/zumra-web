import { z } from 'zod';
import { phoneNumberIsValid } from '@/lib/domain/phone';
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
  updateInstructorProfile,
} from '@/lib/server/services/instructors';
import {
  supportedProgramLanguages,
  supportedProgramLevels,
} from '@/lib/server/services/programs';

const instructorSchema = z.object({
  biography: z.string().trim().max(4000).optional().or(z.literal('')),
  competencies: z
    .array(
      z.object({
        language: z.enum(supportedProgramLanguages),
        levels: z.array(z.enum(supportedProgramLevels)).min(1),
      }),
    )
    .min(1),
  email: z.string().email(),
  firstName: z.string().trim().min(2).max(80),
  internalNotes: z.string().trim().max(4000).optional().or(z.literal('')),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(32).refine(phoneNumberIsValid),
  specialties: z.array(z.string().trim().min(1).max(100)).max(30),
  status: z.enum(['draft', 'active', 'on_leave', 'inactive', 'archived']),
});

export const runtime = 'nodejs';

export async function PATCH(
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
    const parsedId = z.string().uuid().safeParse(instructorId);
    const parsed = instructorSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsedId.success || !parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const instructor = await updateInstructorProfile(
      principal,
      instructorId,
      parsed.data,
    );
    await auditService.record({
      action: 'instructor.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: instructorId,
      targetType: 'instructor_profile',
    });
    return apiResponse(instructor, 200, id);
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
