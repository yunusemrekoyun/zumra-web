import 'server-only';

import { Queue } from 'bullmq';
import {
  defaultJobOptions,
  getBullConnection,
  queueNames,
  reportQueueConnectionError,
} from './config';
import { ensureJobScheduled } from './ensure-job';

const globalForQueue = globalThis as unknown as {
  zumraMeetQueue?: Queue;
};

export function getMeetQueue() {
  if (globalForQueue.zumraMeetQueue) {
    return globalForQueue.zumraMeetQueue;
  }

  const queue = new Queue(queueNames.meet, {
    connection: getBullConnection(),
    defaultJobOptions,
    prefix: 'zumra',
  });
  queue.on('error', (error) => {
    reportQueueConnectionError('meet-queue', error);
  });

  globalForQueue.zumraMeetQueue = queue;
  return queue;
}

export async function enqueueMeetCreation(lessonSessionId: string) {
  return ensureJobScheduled(getMeetQueue(), {
    data: { lessonSessionId },
    jobId: `meet-create-${lessonSessionId}`,
    name: 'create-lesson-meet',
  });
}

export async function enqueueMeetAttendanceSync(
  lessonSessionId: string,
  runAt: Date,
) {
  return ensureJobScheduled(getMeetQueue(), {
    data: { lessonSessionId },
    jobId: `meet-attendance-sync-${lessonSessionId}`,
    name: 'sync-lesson-attendance',
    options: {
      delay: Math.max(0, runAt.getTime() - Date.now()),
    },
  });
}
