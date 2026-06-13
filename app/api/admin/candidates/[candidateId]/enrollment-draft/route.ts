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
import { beginEnrollmentDraft } from '@/lib/server/services/enrollments';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  const { candidateId } = await params;

  try {
    const principal = await requireAdminSession();
    const draft = await beginEnrollmentDraft(principal, candidateId);
    await auditService.record({
      action: draft.created
        ? 'candidate.enrollment_started'
        : 'candidate.enrollment_resumed',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: draft.id,
      targetType: 'enrollment_draft',
    });
    return apiResponse(draft, draft.created ? 201 : 200, id);
  } catch (error) {
    await auditService
      .record({
        action: 'candidate.enrollment_start',
        ip: requestIp(request.headers),
        requestId: id,
        result: 'failed',
        targetId: candidateId,
        targetType: 'candidate',
      })
      .catch(() => undefined);
    return apiErrorResponse(error, id);
  }
}
