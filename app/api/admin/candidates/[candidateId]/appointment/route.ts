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
  appointmentOutcomes,
  resolveAppointment,
  scheduleAppointment,
} from '@/lib/server/services/candidate-pipeline';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), startsAt: z.string().datetime() }),
  z.object({
    action: z.literal('resolve'),
    outcome: z.enum(appointmentOutcomes),
    note: z.string().max(2000).optional(),
  }),
]);

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  const { candidateId } = await params;

  try {
    const principal = await requireStaffSession();
    const parsed = bodySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    if (parsed.data.action === 'schedule') {
      await scheduleAppointment(principal, candidateId, {
        startsAt: parsed.data.startsAt,
      });
    } else {
      await resolveAppointment(principal, candidateId, {
        outcome: parsed.data.outcome,
        note: parsed.data.note,
      });
    }

    await auditService.record({
      action: `candidate.appointment_${parsed.data.action}`,
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: candidateId,
      targetType: 'candidate',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
