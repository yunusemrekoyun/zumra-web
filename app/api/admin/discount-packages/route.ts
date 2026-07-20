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
import { createDiscountPackage } from '@/lib/server/services/pricing';
import { discountPackageSchema } from '@/lib/server/http/pricing-schemas';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = discountPackageSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await createDiscountPackage(principal, parsed.data);
    await auditService.record({
      action: 'discount_package.created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: result.id,
      targetType: 'discount_package',
    });
    return apiResponse(result, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
