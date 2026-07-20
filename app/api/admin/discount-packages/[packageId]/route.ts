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
import { updateDiscountPackage } from '@/lib/server/services/pricing';
import { discountPackageSchema } from '@/lib/server/http/pricing-schemas';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { packageId } = await context.params;

    if (!z.string().uuid().safeParse(packageId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireAdminSession();
    const parsed = discountPackageSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await updateDiscountPackage(
      principal,
      packageId,
      parsed.data,
    );
    await auditService.record({
      action: 'discount_package.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: packageId,
      targetType: 'discount_package',
    });
    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
