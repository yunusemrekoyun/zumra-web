import { z } from 'zod';
import { requireStaffSession } from '@/lib/server/authorization';
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
  candidateTouchpoints,
  logCandidateTouchpoint,
} from '@/lib/server/services/candidate-pipeline';

const touchpointSchema = z.object({
  kind: z.enum(candidateTouchpoints),
  note: z.string().trim().max(500).optional(),
});

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
    const principal = await requireStaffSession();
    const parsed = touchpointSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    await logCandidateTouchpoint(principal, candidateId, parsed.data);
    await auditService.record({
      action: `candidate.contact_${parsed.data.kind}`,
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: candidateId,
      targetType: 'candidate',
    });
    return apiResponse({ ok: true }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
