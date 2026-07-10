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
import { claimTask, completeTask } from '@/lib/server/services/advisor-tasks';

const actionSchema = z.object({
  action: z.enum(['claim', 'complete']),
});

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  const { taskId } = await params;

  try {
    const principal = await requireStaffSession();
    const parsed = actionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    if (parsed.data.action === 'claim') {
      await claimTask(principal, taskId);
    } else {
      await completeTask(principal, taskId);
    }

    await auditService.record({
      action: `advisor.task_${parsed.data.action}`,
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: taskId,
      targetType: 'advisor_task',
    });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
