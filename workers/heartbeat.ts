import os from 'node:os';
import { and, eq, lte } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import { workerHeartbeats } from '@/lib/server/db/schema';
import { getRuntimeEnv } from '@/lib/server/env';
import { getActiveJobs } from './activity';

export function startWorkerHeartbeat(workerId: string) {
  const env = getRuntimeEnv();
  const reportFailure = (error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'worker.heartbeat_failed',
        message: error instanceof Error ? error.message : 'unknown',
        timestamp: new Date().toISOString(),
      }),
    );
  };
  const write = async () => {
    await database
      .update(workerHeartbeats)
      .set({ healthy: false })
      .where(
        and(
          eq(workerHeartbeats.healthy, true),
          lte(
            workerHeartbeats.lastSeenAt,
            new Date(Date.now() - 90_000),
          ),
        ),
      );

    await database
      .insert(workerHeartbeats)
      .values({
        activeJobs: getActiveJobs(),
        healthy: true,
        hostname: os.hostname(),
        lastSeenAt: new Date(),
        processId: process.pid,
        releaseId: env.RELEASE_ID,
        version: process.env.npm_package_version ?? 'unknown',
        workerId,
        workerType: 'combined',
      })
      .onConflictDoUpdate({
        set: {
          healthy: true,
          activeJobs: getActiveJobs(),
          lastSeenAt: new Date(),
          processId: process.pid,
          releaseId: env.RELEASE_ID,
        },
        target: workerHeartbeats.workerId,
      });
  };

  void write().catch(reportFailure);
  const interval = setInterval(() => {
    void write().catch(reportFailure);
  }, 30_000);

  return async () => {
    clearInterval(interval);
    await database
      .update(workerHeartbeats)
      .set({
        activeJobs: 0,
        healthy: false,
        lastSeenAt: new Date(),
      })
      .where(eq(workerHeartbeats.workerId, workerId))
      .catch(() => undefined);
  };
}
