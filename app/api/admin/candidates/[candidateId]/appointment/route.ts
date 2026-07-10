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
  appointmentOutcomeResults,
  appointmentOutcomes,
  createAppointment,
  rescheduleAppointment,
  resolveAppointment,
  scheduleAppointment,
} from '@/lib/server/services/candidate-pipeline';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), startsAt: z.string().datetime() }),
  z.object({ action: z.literal('create'), startsAt: z.string().datetime() }),
  z.object({
    action: z.literal('reschedule'),
    startsAt: z.string().datetime(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('resolve'),
    outcome: z.enum(appointmentOutcomes),
    outcomeResult: z.enum(appointmentOutcomeResults).optional(),
    followUpAt: z.string().datetime().optional(),
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
    } else if (parsed.data.action === 'create') {
      await createAppointment(principal, candidateId, {
        startsAt: parsed.data.startsAt,
      });
    } else if (parsed.data.action === 'reschedule') {
      await rescheduleAppointment(principal, candidateId, {
        note: parsed.data.note,
        startsAt: parsed.data.startsAt,
      });
    } else {
      await resolveAppointment(principal, candidateId, {
        followUpAt: parsed.data.followUpAt,
        note: parsed.data.note,
        outcome: parsed.data.outcome,
        outcomeResult: parsed.data.outcomeResult,
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
