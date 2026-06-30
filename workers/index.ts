import 'dotenv/config';

import os from 'node:os';
import { QueueEvents } from 'bullmq';
import { getMeetQueue } from '@/lib/server/queues/meet';
import { databasePool } from '@/lib/server/db/client';
import { getMediaQueue } from '@/lib/server/queues/media';
import { verifyMailTransport } from '@/lib/server/mail/transport';
import { getMailMode } from '@/lib/server/services/settings';
import { getNotificationQueue } from '@/lib/server/queues/notifications';
import {
  getBullConnection,
  queueNames,
  reportQueueConnectionError,
} from '@/lib/server/queues/config';
import { redis } from '@/lib/server/redis/client';
import { startWorkerHeartbeat } from './heartbeat';
import { startMediaSourceCleanup } from './media-cleanup';
import {
  createMediaWorker,
  requeuePendingMedia,
  startMediaReconciliation,
} from './media-worker';
import {
  createMeetWorker,
  requeuePendingMeetOperations,
  startLessonAutoCloseSweep,
  startMeetReconciliation,
} from './meet-worker';
import {
  createNotificationWorker,
  requeuePendingNotifications,
  startNotificationReconciliation,
} from './notification-worker';

async function main() {
  const workerId = `${os.hostname()}:${process.pid}`;
  const mediaWorker = createMediaWorker(workerId);
  const meetWorker = createMeetWorker(workerId);
  const notificationWorker = createNotificationWorker();
  const mediaEvents = new QueueEvents(queueNames.media, {
    connection: getBullConnection(),
    prefix: 'zumra',
  });
  const meetEvents = new QueueEvents(queueNames.meet, {
    connection: getBullConnection(),
    prefix: 'zumra',
  });
  const notificationEvents = new QueueEvents(queueNames.notifications, {
    connection: getBullConnection(),
    prefix: 'zumra',
  });
  const stopHeartbeat = startWorkerHeartbeat(workerId);
  const stopMediaSourceCleanup = startMediaSourceCleanup();
  const stopMediaReconciliation = startMediaReconciliation();
  const stopMeetReconciliation = startMeetReconciliation();
  const stopLessonAutoCloseSweep = startLessonAutoCloseSweep();
  const stopNotificationReconciliation = startNotificationReconciliation();

  const mailMode = await getMailMode().catch(() => 'live' as const);
  await verifyMailTransport(mailMode)
    .then(() => {
      console.log(
        JSON.stringify({
          event: 'mail.transport_verified',
          mode: mailMode,
          timestamp: new Date().toISOString(),
        }),
      );
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: 'mail.transport_verify_failed',
          message:
            error instanceof Error
              ? error.message.slice(0, 500)
              : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      );
    });

  await requeuePendingNotifications();
  await requeuePendingMedia();
  await requeuePendingMeetOperations();

  for (const events of [mediaEvents, meetEvents, notificationEvents]) {
    events.on('error', (error) => {
      reportQueueConnectionError(
        events === mediaEvents
          ? 'media-queue-events'
          : events === meetEvents
            ? 'meet-queue-events'
          : 'notification-queue-events',
        error,
      );
    });
    events.on('failed', ({ jobId, failedReason }) => {
      console.error(
        JSON.stringify({
          event: 'queue.job_failed',
          failedReason: failedReason.slice(0, 500),
          jobId,
          timestamp: new Date().toISOString(),
        }),
      );
    });
    events.on('stalled', ({ jobId }) => {
      console.warn(
        JSON.stringify({
          event: 'queue.job_stalled',
          jobId,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(JSON.stringify({ event: 'worker.shutdown', signal }));
    await stopHeartbeat();
    stopMediaSourceCleanup();
    stopMediaReconciliation();
    stopMeetReconciliation();
    stopLessonAutoCloseSweep();
    stopNotificationReconciliation();
    await Promise.all([
      mediaWorker.close(),
      meetWorker.close(),
      notificationWorker.close(),
      mediaEvents.close(),
      meetEvents.close(),
      notificationEvents.close(),
      getMeetQueue().close(),
      getMediaQueue().close(),
      getNotificationQueue().close(),
    ]);
    await redis.quit().catch(() => undefined);
    await databasePool.end();
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT').then(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM').then(() => process.exit(0));
  });

  console.log(
    JSON.stringify({
      event: 'worker.started',
      workerId,
    }),
  );
}

void main().catch((error) => {
  console.error(
    JSON.stringify({
      event: 'worker.start_failed',
      message: error instanceof Error ? error.message.slice(0, 500) : 'unknown',
    }),
  );
  process.exitCode = 1;
});
