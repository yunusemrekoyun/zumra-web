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
  createInstructorProfile,
  InstructorIdentityConflictError,
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
  allowArchivedDuplicate: z.boolean().optional(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = instructorSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const instructor = await createInstructorProfile(principal, parsed.data);
    await auditService.record({
      action: 'instructor.created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: instructor?.id,
      targetType: 'instructor_profile',
    });
    return apiResponse(instructor ?? {}, 201, id);
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
