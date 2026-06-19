import 'server-only';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  notificationOutbox,
  workerHeartbeats,
} from '@/lib/server/db/schema';
import { getRuntimeEnv } from '@/lib/server/env';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';
import { enqueueNotificationOutbox } from '@/lib/server/queues/notifications';

const HEARTBEAT_FRESH_MS = 90 * 1000;
const RETRY_LIMIT = 100;

const outboxStatuses = [
  'pending',
  'queued',
  'processing',
  'sent',
  'failed',
  'dead',
] as const;

export type BackgroundJobStatus = {
  lastError?: {
    createdAt: string;
    id: string;
    message: string;
    status: 'failed' | 'dead';
    templateKey: string;
  };
  notificationCounts: Record<(typeof outboxStatuses)[number], number>;
  releaseId: string;
  worker?: {
    activeJobs: number;
    healthy: boolean;
    id: string;
    lastSeenAt: string;
    stale: boolean;
    type: string;
  };
};

export async function getBackgroundJobStatus(
  principal: WorkspacePrincipal,
): Promise<BackgroundJobStatus> {
  assertAdmin(principal);

  const [heartbeat] = await database
    .select({
      activeJobs: workerHeartbeats.activeJobs,
      healthy: workerHeartbeats.healthy,
      id: workerHeartbeats.workerId,
      lastSeenAt: workerHeartbeats.lastSeenAt,
      type: workerHeartbeats.workerType,
    })
    .from(workerHeartbeats)
    .orderBy(desc(workerHeartbeats.lastSeenAt))
    .limit(1);

  const counts = await database
    .select({
      count: sql<number>`count(*)`,
      status: notificationOutbox.status,
    })
    .from(notificationOutbox)
    .groupBy(notificationOutbox.status);

  const notificationCounts = Object.fromEntries(
    outboxStatuses.map((status) => [status, 0]),
  ) as BackgroundJobStatus['notificationCounts'];

  for (const row of counts) {
    notificationCounts[row.status] = Number(row.count);
  }

  const [lastError] = await database
    .select({
      createdAt: notificationOutbox.updatedAt,
      id: notificationOutbox.id,
      lastError: notificationOutbox.lastError,
      status: notificationOutbox.status,
      templateKey: notificationOutbox.templateKey,
    })
    .from(notificationOutbox)
    .where(inArray(notificationOutbox.status, ['failed', 'dead']))
    .orderBy(desc(notificationOutbox.updatedAt))
    .limit(1);

  const lastSeenAt = heartbeat?.lastSeenAt;
  const stale = lastSeenAt
    ? Date.now() - lastSeenAt.getTime() > HEARTBEAT_FRESH_MS
    : true;

  return {
    lastError:
      lastError &&
      (lastError.status === 'failed' || lastError.status === 'dead')
        ? {
            createdAt: lastError.createdAt.toISOString(),
            id: lastError.id,
            message: lastError.lastError ?? 'Notification delivery failed.',
            status: lastError.status,
            templateKey: lastError.templateKey,
          }
        : undefined,
    notificationCounts,
    releaseId: getRuntimeEnv().RELEASE_ID,
    worker: heartbeat
      ? {
          activeJobs: heartbeat.activeJobs,
          healthy: heartbeat.healthy && !stale,
          id: heartbeat.id,
          lastSeenAt: heartbeat.lastSeenAt.toISOString(),
          stale,
          type: heartbeat.type,
        }
      : undefined,
  };
}

export async function retryFailedNotifications(
  principal: WorkspacePrincipal,
) {
  assertAdmin(principal);

  const now = new Date();
  const rows = await database
    .update(notificationOutbox)
    .set({
      availableAt: now,
      leaseExpiresAt: null,
      lockedAt: null,
      lockedBy: null,
      status: 'pending',
      updatedAt: now,
    })
    .where(
      and(
        inArray(notificationOutbox.status, ['failed', 'dead']),
        eq(notificationOutbox.channel, 'email'),
      ),
    )
    .returning({ id: notificationOutbox.id });

  const selected = rows.slice(0, RETRY_LIMIT);
  for (const row of selected) {
    await enqueueNotificationOutbox(row.id);
  }

  return {
    requeued: selected.length,
    totalMatched: rows.length,
  };
}

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}
