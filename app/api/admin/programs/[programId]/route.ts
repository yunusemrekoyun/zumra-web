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
import { deleteUnusedProgram } from '@/lib/server/services/programs';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const { programId } = await params;
    if (!z.string().uuid().safeParse(programId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }
    const result = await deleteUnusedProgram(principal, programId);
    await auditService.record({
      action: 'program.deleted',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: programId,
      targetType: 'program',
    });
    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
