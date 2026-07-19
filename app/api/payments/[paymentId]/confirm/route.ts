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
import { confirmPaymentRecord } from '@/lib/server/services/payments';

const confirmSchema = z.object({
  amountCents: z.number().int().positive(),
  receiptMediaAssetId: z.string().uuid().optional(),
  reviewNote: z.string().max(500).optional(),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { paymentId } = await context.params;

    if (!z.string().uuid().safeParse(paymentId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const parsed = confirmSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await confirmPaymentRecord(principal, {
      ...parsed.data,
      paymentId,
    });
    await auditService.record({
      action: 'teacher-payment.confirmed',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: paymentId,
      targetType: 'payment_record',
    });
    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
