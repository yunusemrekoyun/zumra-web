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
import { setUserProfilePhoto } from '@/lib/server/services/profile-photo';

const photoSchema = z.object({ mediaAssetId: z.string().uuid() });

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }
  const { userId } = await params;
  try {
    const principal = await requireAdminSession();
    const parsed = photoSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }
    await setUserProfilePhoto(principal, userId, parsed.data.mediaAssetId);
    await auditService.record({
      action: 'profile.photo_updated_by_admin',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: userId,
      targetType: 'user',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }
  const { userId } = await params;
  try {
    const principal = await requireAdminSession();
    await setUserProfilePhoto(principal, userId, null);
    await auditService.record({
      action: 'profile.photo_removed_by_admin',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: userId,
      targetType: 'user',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
