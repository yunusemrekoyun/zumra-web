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
import { setCommissionRate } from '@/lib/server/services/payments';

const rateSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    instructorId: z.string().uuid().optional(),
    note: z.string().max(300).optional(),
    scope: z.enum(['branch', 'instructor_private']),
    teacherShareBasisPoints: z.number().int().min(0).max(10000),
  })
  .refine(
    (value) =>
      value.scope === 'branch'
        ? Boolean(value.branchId) && !value.instructorId
        : Boolean(value.instructorId) && !value.branchId,
    { message: 'scope_target_mismatch' },
  );

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = rateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const catalog = await setCommissionRate(principal, parsed.data);
    await auditService.record({
      action: 'commission_rate.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: parsed.data.branchId ?? parsed.data.instructorId,
      targetType: 'commission_rate',
    });
    return apiResponse(catalog, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
