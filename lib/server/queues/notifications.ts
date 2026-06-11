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
  zumraNotificationQueue?: Queue;
};

export function getNotificationQueue() {
  if (globalForQueue.zumraNotificationQueue) {
    return globalForQueue.zumraNotificationQueue;
  }

  const queue = new Queue(queueNames.notifications, {
    connection: getBullConnection(),
    defaultJobOptions,
    prefix: 'zumra',
  });
  queue.on('error', (error) => {
    reportQueueConnectionError('notification-queue', error);
  });

  globalForQueue.zumraNotificationQueue = queue;
  return queue;
}

export async function enqueueNotificationOutbox(outboxId: string) {
  return ensureJobScheduled(getNotificationQueue(), {
    data: { outboxId },
    jobId: `outbox-${outboxId}`,
    name: 'deliver-outbox',
  });
}
