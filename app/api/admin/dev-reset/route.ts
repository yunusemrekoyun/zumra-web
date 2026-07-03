import { verifyPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import { accounts } from '@/lib/server/db/schema';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { getRuntimeEnv } from '@/lib/server/env';
import { getMeetQueue } from '@/lib/server/queues/meet';
import { getMediaQueue } from '@/lib/server/queues/media';
import { getNotificationQueue } from '@/lib/server/queues/notifications';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { auditService } from '@/lib/server/services/audit';
import { resetDevelopmentWorkspaceData } from '@/lib/server/services/dev-reset';

const CONFIRMATION_PHRASE = 'SIFIRLA';

const inputSchema = z.object({
  confirmation: z.literal(CONFIRMATION_PHRASE),
  password: z.string().min(12).max(128),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!getRuntimeEnv().DEV_RESET_ENABLED) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireDevelopmentResetAdmin(parsed.data.password);
    const result = await resetDevelopmentWorkspaceData(principal);
    const queuesCleared = await clearBackgroundQueues();

    await auditService.record({
      action: 'admin.dev_reset',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: {
        preservedAdminUserId: result.preservedAdminUserId,
        queuesCleared,
        resetAt: result.resetAt,
      },
      requestId: id,
      result: 'success',
      targetType: 'workspace',
    });

    return apiResponse(
      {
        deletedCounts: result.deletedCounts,
        preservedAdminUserId: result.preservedAdminUserId,
        queuesCleared,
        resetAt: result.resetAt,
        status: 'reset',
      },
      200,
      id,
    );
  } catch (error) {
    await auditService
      .record({
        action: 'admin.dev_reset',
        ip: requestIp(request.headers),
        requestId: id,
        result: 'failed',
        targetType: 'workspace',
      })
      .catch(() => undefined);

    return apiErrorResponse(error, id);
  }
}

async function requireDevelopmentResetAdmin(
  password: string,
): Promise<WorkspacePrincipal> {
  const principal = await requireSession();

  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }

  const [credential] = await database
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, principal.id),
        eq(accounts.providerId, 'credential'),
      ),
    )
    .limit(1);

  if (
    !credential?.password ||
    !(await verifyPassword({ hash: credential.password, password }))
  ) {
    throw new PublicFlowError('password_failed', 403);
  }

  return principal;
}

async function clearBackgroundQueues() {
  const queues = [getMeetQueue(), getMediaQueue(), getNotificationQueue()];
  await Promise.all(
    queues.map(async (queue) => {
      await queue.drain(true);
      await Promise.all(
        ([
          'completed',
          'delayed',
          'failed',
          'paused',
          'prioritized',
          'wait',
        ] as const).map((state) =>
          queue.clean(0, 1000, state).catch(() => undefined),
        ),
      );
    }),
  );
  return true;
}
