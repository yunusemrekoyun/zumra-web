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
import { addCandidateNote } from '@/lib/server/services/candidate-pipeline';

const noteSchema = z.object({
  body: z.string().trim().min(1).max(2000),
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
    const principal = await requireAdminSession();
    const parsed = noteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    await addCandidateNote(principal, candidateId, parsed.data.body);
    await auditService.record({
      action: 'candidate.note_added',
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
