import { type Job, Worker } from 'bullmq';
import { tryAcquireAdvisoryLock } from '@/lib/server/db/advisory-lock';
import { getRuntimeEnv } from '@/lib/server/env';
import {
  getBullConnection,
  queueNames,
  reportQueueConnectionError,
} from '@/lib/server/queues/config';
import {
  autoCloseStaleLessons,
  createLessonMeetingForSession,
  requeuePendingLessonMeetOperations,
  syncLessonAttendanceFromMeet,
} from '@/lib/server/services/lesson-meetings';
import { beginJob, endJob } from './activity';

const RECONCILIATION_INTERVAL_MS = 60 * 1000;

// Runs a periodic sweep behind a non-blocking advisory lock so that when
// multiple worker instances are running, only one executes the sweep per tick.
async function withSweepLock(key: string, run: () => Promise<unknown>) {
  const release = await tryAcquireAdvisoryLock(key);
  if (!release) return;
  try {
    await run();
  } finally {
    await release();
  }
}

export function createMeetWorker(workerId: string) {
  const env = getRuntimeEnv();
  const worker = new Worker(
    queueNames.meet,
    (job) => processMeetJob(job),
    {
      concurrency: env.WORKER_CONCURRENCY,
      connection: getBullConnection(),
      name: workerId,
      prefix: 'zumra',
    },
  );

  worker.on('error', (error) => {
    reportQueueConnectionError('meet-worker', error);
  });

  return worker;
}

export async function requeuePendingMeetOperations() {
  await requeuePendingLessonMeetOperations();
}

export function startMeetReconciliation() {
  const run = () => {
    void withSweepLock(
      'sweep:meet-reconciliation',
      requeuePendingMeetOperations,
    ).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'meet.reconciliation_failed',
          message: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      );
    });
  };

  const interval = setInterval(run, RECONCILIATION_INTERVAL_MS);
  return () => clearInterval(interval);
}

export function startLessonAutoCloseSweep() {
  const run = () => {
    void withSweepLock('sweep:lesson-auto-close', autoCloseStaleLessons).catch(
      (error) => {
        console.error(
          JSON.stringify({
            event: 'lesson.auto_close_failed',
            message: error instanceof Error ? error.message : 'unknown',
            timestamp: new Date().toISOString(),
          }),
        );
      },
    );
  };

  const interval = setInterval(run, RECONCILIATION_INTERVAL_MS);
  return () => clearInterval(interval);
}

async function processMeetJob(job: Job) {
  const lessonSessionId = String(job.data.lessonSessionId ?? '');

  if (!lessonSessionId) {
    return;
  }

  beginJob();
  try {
    if (job.name === 'create-lesson-meet') {
      await createLessonMeetingForSession(lessonSessionId);
      return;
    }

    if (job.name === 'sync-lesson-attendance') {
      await syncLessonAttendanceFromMeet(lessonSessionId);
      return;
    }

    throw new Error(`Unknown Meet job: ${job.name}`);
  } finally {
    endJob();
  }
}
