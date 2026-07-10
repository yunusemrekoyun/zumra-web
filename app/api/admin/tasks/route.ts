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
import { createManualTask } from '@/lib/server/services/advisor-tasks';

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime().optional(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireStaffSession();
    const parsed = taskSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    await createManualTask(principal, parsed.data);
    await auditService.record({
      action: 'advisor.task_created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: principal.id,
      targetType: 'advisor_task',
    });
    return apiResponse({ ok: true }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
