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
  assignCandidateAdvisor,
  candidateStages,
  updateCandidateStage,
} from '@/lib/server/services/candidate-pipeline';

const patchSchema = z.object({
  advisorId: z.string().min(1).nullable().optional(),
  stage: z.enum(candidateStages).optional(),
});

export const runtime = 'nodejs';

export async function PATCH(
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
    const parsed = patchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (
      !parsed.success ||
      (parsed.data.stage === undefined && parsed.data.advisorId === undefined)
    ) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    if (parsed.data.stage !== undefined) {
      await updateCandidateStage(principal, candidateId, parsed.data.stage);
    }
    if (parsed.data.advisorId !== undefined) {
      await assignCandidateAdvisor(
        principal,
        candidateId,
        parsed.data.advisorId,
      );
    }

    await auditService.record({
      action: 'candidate.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: candidateId,
      targetType: 'candidate',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
