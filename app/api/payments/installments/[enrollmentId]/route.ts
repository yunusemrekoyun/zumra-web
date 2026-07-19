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
import {
  listEnrollmentInstallments,
  saveEnrollmentInstallmentPlan,
} from '@/lib/server/services/payments';

const planSchema = z.object({
  plan: z
    .array(
      z.object({
        amountCents: z.number().int().positive(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        id: z.string().uuid().optional(),
        label: z.string().max(80).optional(),
        note: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(60),
});

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ enrollmentId: string }> },
) {
  const id = requestId(request);

  try {
    const { enrollmentId } = await context.params;

    if (!z.string().uuid().safeParse(enrollmentId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireStaffSession();
    const installments = await listEnrollmentInstallments(
      principal,
      enrollmentId,
    );
    return apiResponse({ installments }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ enrollmentId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { enrollmentId } = await context.params;

    if (!z.string().uuid().safeParse(enrollmentId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireStaffSession();
    const parsed = planSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const installments = await saveEnrollmentInstallmentPlan(
      principal,
      enrollmentId,
      parsed.data.plan,
    );
    await auditService.record({
      action: 'payment.installment_plan_updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: enrollmentId,
      targetType: 'enrollment',
    });
    return apiResponse({ installments }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
