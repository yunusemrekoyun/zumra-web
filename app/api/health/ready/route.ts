import { NextResponse } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { checkDatabaseConnection, database } from '@/lib/server/db/client';
import { workerHeartbeats } from '@/lib/server/db/schema';
import { getAuthEnv, getRuntimeEnv } from '@/lib/server/env';
import { ensureRedisConnection } from '@/lib/server/redis/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = request.headers.get('authorization');

  if (token !== `Bearer ${getAuthEnv().READINESS_TOKEN}`) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const checks = {
    database: false,
    redis: false,
    worker: false,
  };

  try {
    await Promise.all([
      checkDatabaseConnection().then(() => {
        checks.database = true;
      }),
      ensureRedisConnection().then(() => {
        checks.redis = true;
      }),
      database
        .select({ workerId: workerHeartbeats.workerId })
        .from(workerHeartbeats)
        .where(
          and(
            eq(workerHeartbeats.healthy, true),
            eq(workerHeartbeats.releaseId, getRuntimeEnv().RELEASE_ID),
            gt(
              workerHeartbeats.lastSeenAt,
              new Date(Date.now() - 90 * 1000),
            ),
          ),
        )
        .limit(1)
        .then((rows) => {
          checks.worker = rows.length > 0;
        }),
    ]);
  } catch {
    // Individual booleans communicate which dependency is unavailable.
  }

  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    {
      checks,
      status: ready ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
      status: ready ? 200 : 503,
    },
  );
}
