import 'server-only';

import { eq } from 'drizzle-orm';
import type {
  NotificationMessage,
  NotificationService,
} from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import { notificationOutbox } from '@/lib/server/db/schema';
import { enqueueNotificationOutbox } from '@/lib/server/queues/notifications';
import { encryptJson } from '@/lib/server/security/encryption';

export const notificationService: NotificationService = {
  async enqueue(message: NotificationMessage) {
    const [created] = await database
      .insert(notificationOutbox)
      .values({
        channel: message.channel,
        encryptedPayload: message.sensitivePayload
          ? encryptJson(message.sensitivePayload)
          : undefined,
        idempotencyKey: message.idempotencyKey,
        locale: message.locale,
        payload: message.payload,
        recipient: message.recipient,
        templateKey: message.templateKey,
      })
      .onConflictDoNothing({
        target: notificationOutbox.idempotencyKey,
      })
      .returning({ id: notificationOutbox.id });

    if (!created) {
      const [existing] = await database
        .select({ id: notificationOutbox.id })
        .from(notificationOutbox)
        .where(eq(notificationOutbox.idempotencyKey, message.idempotencyKey))
        .limit(1);

      if (!existing) {
        throw new Error('Notification outbox row could not be created.');
      }

      return { outboxId: existing.id };
    }

    try {
      await enqueueNotificationOutbox(created.id);
      await database
        .update(notificationOutbox)
        .set({ status: 'queued', updatedAt: new Date() })
        .where(eq(notificationOutbox.id, created.id));
    } catch {
      // The outbox dispatcher can requeue this row after Redis recovers.
    }

    return { outboxId: created.id };
  },
};
