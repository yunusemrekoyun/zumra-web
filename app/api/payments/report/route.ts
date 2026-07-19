import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { reportStudentPayment } from '@/lib/server/services/payments';

const reportSchema = z.object({
  amountCents: z.number().int().positive(),
  enrollmentId: z.string().uuid(),
  installmentId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireSession();
    const parsed = reportSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await reportStudentPayment(principal, parsed.data);
    return apiResponse(result, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
