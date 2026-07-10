import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
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
import { setOwnProfilePhoto } from '@/lib/server/services/profile-photo';

const photoSchema = z.object({ mediaAssetId: z.string().uuid() });

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }
  try {
    const principal = await requireSession();
    const parsed = photoSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }
    await setOwnProfilePhoto(principal, parsed.data.mediaAssetId);
    await auditService.record({
      action: 'profile.photo_updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: principal.id,
      targetType: 'user',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function DELETE(request: Request) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }
  try {
    const principal = await requireSession();
    await setOwnProfilePhoto(principal, null);
    await auditService.record({
      action: 'profile.photo_removed',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: principal.id,
      targetType: 'user',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
