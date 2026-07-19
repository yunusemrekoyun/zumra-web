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
import { createStaffPayment } from '@/lib/server/services/payments';

const staffPaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  enrollmentId: z.string().uuid(),
  installmentId: z.string().uuid().optional(),
  method: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  receiptMediaAssetId: z.string().uuid().optional(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireStaffSession();
    const parsed = staffPaymentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await createStaffPayment(principal, parsed.data);
    await auditService.record({
      action: 'payment.staff_recorded',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: result.paymentId,
      targetType: 'payment_record',
    });
    return apiResponse(result, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
