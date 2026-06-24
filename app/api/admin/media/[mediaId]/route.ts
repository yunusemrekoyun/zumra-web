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
import { deleteOrphanMedia } from '@/lib/server/services/storage-admin';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  const { mediaId } = await params;

  try {
    const principal = await requireAdminSession();
    await deleteOrphanMedia(principal, mediaId);
    await auditService.record({
      action: 'media.orphan_deleted',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: mediaId,
      targetType: 'media',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
