import { z } from 'zod';
import { requireCriticalAdmin } from '@/lib/server/authorization';
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
import { getInstructorProfile } from '@/lib/server/services/instructors';
import { invitationService } from '@/lib/server/services/invitations';

const inputSchema = z.object({
  locale: z.enum(['tr', 'en']).default('tr'),
  password: z.string().min(12).max(128),
  username: z.string().min(5).max(30),
});

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
    const { instructorId } = await context.params;
    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!z.string().uuid().safeParse(instructorId).success || !parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireCriticalAdmin(parsed.data.password);
    const profile = await getInstructorProfile(principal, instructorId);
    if (!profile || profile.userId) {
      return apiResponse({ error: 'instructor_account_unavailable' }, 409, id);
    }

    const invitation = await invitationService.create(principal, {
      email: profile.email,
      instructorProfileId: profile.id,
      locale: parsed.data.locale,
      name: profile.fullName,
      role: 'teacher',
      username: parsed.data.username,
    });
    await auditService.record({
      action: 'instructor.invitation_created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: instructorId,
      targetType: 'instructor_profile',
    });
    return apiResponse(invitation, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
