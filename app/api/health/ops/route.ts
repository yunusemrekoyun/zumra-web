import { statfs } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { database, databasePool } from '@/lib/server/db/client';
import { backupRuns, workerHeartbeats } from '@/lib/server/db/schema';
import { getAuthEnv, getRuntimeEnv } from '@/lib/server/env';
import { getMediaQueue } from '@/lib/server/queues/media';
import { getNotificationQueue } from '@/lib/server/queues/notifications';
import { ensureRedisConnection } from '@/lib/server/redis/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const env = { ...getRuntimeEnv(), ...getAuthEnv() };

  if (request.headers.get('authorization') !== `Bearer ${env.READINESS_TOKEN}`) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const checks: Record<string, { ok: boolean; value?: number | string }> = {};

  await Promise.all([
    checkStorage(env.MEDIA_ROOT).then((storage) => {
      checks.disk = {
        ok: storage.diskUsedPercent < env.MEDIA_DISK_BLOCK_PERCENT,
        value: storage.diskUsedPercent,
      };
      checks.inodes = {
        ok: storage.inodeUsedPercent < 90,
        value: storage.inodeUsedPercent,
      };
    }),
    databasePool.query<{
      last_archived_time: Date | null;
    }>('select last_archived_time from pg_stat_archiver').then((result) => {
      const archivedAt = result.rows[0]?.last_archived_time;
      const ageMinutes = archivedAt
        ? Math.round((Date.now() - archivedAt.getTime()) / 60_000)
        : 'missing';
      checks.walArchive = {
        ok: typeof ageMinutes === 'number' && ageMinutes <= 20,
        value: ageMinutes,
      };
    }),
    ensureRedisConnection().then(() => {
      checks.redis = { ok: true };
    }),
    Promise.all([
      getMediaQueue().getFailedCount(),
      getNotificationQueue().getFailedCount(),
    ]).then(([mediaFailed, notificationFailed]) => {
      const total = mediaFailed + notificationFailed;
      checks.failedJobs = { ok: total < 25, value: total };
    }),
    database
      .select({
        activeJobs: workerHeartbeats.activeJobs,
        lastSeenAt: workerHeartbeats.lastSeenAt,
      })
      .from(workerHeartbeats)
      .where(
        and(
          eq(workerHeartbeats.healthy, true),
          eq(workerHeartbeats.releaseId, env.RELEASE_ID),
        ),
      )
      .orderBy(desc(workerHeartbeats.lastSeenAt))
      .limit(1)
      .then(([heartbeat]) => {
        const ageSeconds = heartbeat
          ? Math.round((Date.now() - heartbeat.lastSeenAt.getTime()) / 1000)
          : 'missing';
        checks.worker = {
          ok: typeof ageSeconds === 'number' && ageSeconds <= 90,
          value: ageSeconds,
        };
        checks.activeJobs = {
          ok: (heartbeat?.activeJobs ?? 0) <= env.WORKER_CONCURRENCY + 5,
          value: heartbeat?.activeJobs ?? 0,
        };
      }),
    checkBackupAge('logical', 36).then((check) => {
      checks.logicalBackup = check;
    }),
    checkBackupAge('physical_full', 8 * 24).then((check) => {
      checks.physicalBackup = check;
    }),
    checkBackupAge('restic', 36).then((check) => {
      checks.offsiteBackup = check;
    }),
    checkBackupAge('wal', 1).then((check) => {
      checks.walBackup = check;
    }),
  ]).catch((error) => {
    checks.internal = {
      ok: false,
      value: error instanceof Error ? error.name : 'dependency_error',
    };
  });

  const healthy = Object.values(checks).every((check) => check.ok);
  return NextResponse.json(
    {
      checks,
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
    },
    {
      headers: { 'Cache-Control': 'no-store' },
      status: healthy ? 200 : 503,
    },
  );
}

async function checkBackupAge(
  kind: (typeof backupRuns.$inferSelect)['kind'],
  maximumHours: number,
) {
  const [run] = await database
    .select({ completedAt: backupRuns.completedAt })
    .from(backupRuns)
    .where(
      and(eq(backupRuns.kind, kind), eq(backupRuns.status, 'succeeded')),
    )
    .orderBy(desc(backupRuns.completedAt))
    .limit(1);
  const ageHours = run?.completedAt
    ? Math.round((Date.now() - run.completedAt.getTime()) / 3_600_000)
    : 'missing';

  return {
    ok: typeof ageHours === 'number' && ageHours <= maximumHours,
    value: ageHours,
  };
}

async function checkStorage(root: string) {
  const fileSystem = await statfs(root);
  const diskUsedPercent =
    fileSystem.blocks > 0
      ? Math.round(
          ((fileSystem.blocks - fileSystem.bavail) / fileSystem.blocks) * 100,
        )
      : 100;
  const inodeUsedPercent =
    fileSystem.files > 0
      ? Math.round(
          ((fileSystem.files - fileSystem.ffree) / fileSystem.files) * 100,
        )
      : 100;

  return { diskUsedPercent, inodeUsedPercent };
}
