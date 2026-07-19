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
  listUnsettledPayments,
  recordTeacherSettlement,
} from '@/lib/server/services/payments';

const settlementSchema = z.object({
  instructorId: z.string().uuid(),
  note: z.string().max(300).optional(),
  paymentIds: z.array(z.string().uuid()).min(1).max(500),
});

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    const principal = await requireAdminSession();
    const instructorId = new URL(request.url).searchParams.get('instructorId');

    if (!instructorId || !z.string().uuid().safeParse(instructorId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const payments = await listUnsettledPayments(principal, instructorId);
    return apiResponse({ payments }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = settlementSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await recordTeacherSettlement(principal, parsed.data);
    await auditService.record({
      action: 'teacher_settlement.recorded',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: result.settlementId,
      targetType: 'teacher_settlement',
    });
    return apiResponse(result, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
