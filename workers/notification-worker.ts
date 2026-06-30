import { Worker } from 'bullmq';
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import { notificationOutbox } from '@/lib/server/db/schema';
import { getMailEnv } from '@/lib/server/env';
import { getMailTransport } from '@/lib/server/mail/transport';
import { renderMailTemplate } from '@/lib/server/mail/templates';
import { getMailMode } from '@/lib/server/services/settings';
import { enqueueNotificationOutbox } from '@/lib/server/queues/notifications';
import {
  getBullConnection,
  queueNames,
  reportQueueConnectionError,
} from '@/lib/server/queues/config';
import { decryptJson } from '@/lib/server/security/encryption';
import { beginJob, endJob } from './activity';

const LEASE_MS = 5 * 60 * 1000;
const RECONCILIATION_INTERVAL_MS = 60 * 1000;

export function createNotificationWorker() {
  const worker = new Worker(
    queueNames.notifications,
    async (job) => {
      const outboxId = String(job.data.outboxId ?? '');
      const workerId = String(job.processedBy ?? 'notification-worker');
      const now = new Date();
      const [message] = await database
        .update(notificationOutbox)
        .set({
          attempts: sql`${notificationOutbox.attempts} + 1`,
          leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
          lockedAt: now,
          lockedBy: workerId,
          status: 'processing',
          updatedAt: now,
        })
        .where(
          and(
            eq(notificationOutbox.id, outboxId),
            inArray(notificationOutbox.status, [
              'pending',
              'queued',
              'processing',
              'failed',
            ]),
            or(
              isNull(notificationOutbox.leaseExpiresAt),
              lte(notificationOutbox.leaseExpiresAt, now),
            ),
          ),
        )
        .returning();

      if (!message) {
        return;
      }

      beginJob();
      try {
        if (message.channel !== 'email') {
          throw new Error('Notification channel is not configured.');
        }

        const sensitivePayload = message.encryptedPayload
          ? decryptJson(message.encryptedPayload)
          : {};
        const rendered = renderMailTemplate({
          locale: message.locale,
          payload: message.payload,
          sensitivePayload,
          templateKey: message.templateKey,
        });

        const mailMode = await getMailMode();
        const delivery = await getMailTransport(mailMode).sendMail({
          from: getMailEnv().SMTP_FROM,
          html: rendered.html,
          subject: rendered.subject,
          text: rendered.text,
          to: message.recipient,
        });

        await database
          .update(notificationOutbox)
          .set({
            encryptedPayload: null,
            lastError: null,
            leaseExpiresAt: null,
            lockedAt: null,
            lockedBy: null,
            processedAt: new Date(),
            providerMessageId: delivery.messageId || null,
            status: 'sent',
            updatedAt: new Date(),
          })
          .where(eq(notificationOutbox.id, outboxId));
      } catch (error) {
        const finalAttempt =
          job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
        await database
          .update(notificationOutbox)
          .set({
            lastError:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Unknown notification error',
            leaseExpiresAt: null,
            lockedAt: null,
            lockedBy: null,
            status: finalAttempt ? 'dead' : 'failed',
            updatedAt: new Date(),
          })
          .where(eq(notificationOutbox.id, outboxId));
        throw error;
      } finally {
        endJob();
      }
    },
    {
      concurrency: 5,
      connection: getBullConnection(),
      prefix: 'zumra',
    },
  );

  worker.on('error', (error) => {
    reportQueueConnectionError('notification-worker', error);
  });

  return worker;
}

export async function requeuePendingNotifications() {
  const messages = await database
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(
      and(
        inArray(notificationOutbox.status, [
          'pending',
          'queued',
          'processing',
          'failed',
        ]),
        lte(notificationOutbox.availableAt, new Date()),
        or(
          isNull(notificationOutbox.leaseExpiresAt),
          lte(notificationOutbox.leaseExpiresAt, new Date()),
        ),
      ),
    )
    .limit(500);

  for (const message of messages) {
    await enqueueNotificationOutbox(message.id);
  }
}

export function startNotificationReconciliation() {
  const run = () => {
    void requeuePendingNotifications().catch((error) => {
      console.error(
        JSON.stringify({
          event: 'notification.reconciliation_failed',
          message: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      );
    });
  };

  const interval = setInterval(run, RECONCILIATION_INTERVAL_MS);
  return () => clearInterval(interval);
}
