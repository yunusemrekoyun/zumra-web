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
  zumraMediaQueue?: Queue;
};

export function getMediaQueue() {
  if (globalForQueue.zumraMediaQueue) {
    return globalForQueue.zumraMediaQueue;
  }

  const queue = new Queue(queueNames.media, {
    connection: getBullConnection(),
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 3,
    },
    prefix: 'zumra',
  });
  queue.on('error', (error) => {
    reportQueueConnectionError('media-queue', error);
  });

  globalForQueue.zumraMediaQueue = queue;
  return queue;
}

export async function enqueueMediaProcessing(
  mediaId: string,
  generation: number,
) {
  return ensureJobScheduled(getMediaQueue(), {
    data: { generation, mediaId },
    jobId: `media-${mediaId}-${generation}`,
    name: 'process-media',
  });
}
