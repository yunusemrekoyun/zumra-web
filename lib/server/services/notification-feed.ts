import 'server-only';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import { notifications } from '@/lib/server/db/schema';

export type NotificationType =
  | 'assignment_assigned'
  | 'assignment_submitted'
  | 'assignment_graded'
  | 'chat_message'
  | 'lead_received'
  | 'payment_reported'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'payment_review_stale'
  | 'installment_due'
  | 'settlement_recorded'
  | 'task_due'
  | 'manual_discount_applied'
  | 'branch_schedule_updated'
  | 'lesson_change_requested'
  | 'lesson_change_request_decided'
  | 'lesson_session_changed';

export type NotificationView = {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  href?: string;
  read: boolean;
  createdAt: string;
};

export type NotificationEntry = {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  href?: string;
};

export async function createNotifications(
  entries: NotificationEntry[],
): Promise<void> {
  if (!entries.length) return;
  await database.insert(notifications).values(
    entries.map((entry) => ({
      userId: entry.userId,
      type: entry.type,
      payload: entry.payload,
      href: entry.href ?? null,
    })),
  );
}

// Chat notifications collapse to one entry per conversation: drop the prior
// unread one before inserting a fresh one, so the bell shows "X from Y" once.
export async function createChatNotification(
  userId: string,
  conversationId: string,
  payload: Record<string, unknown>,
  href: string,
): Promise<void> {
  await database
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, 'chat_message'),
        isNull(notifications.readAt),
        sql`${notifications.payload}->>'conversationId' = ${conversationId}`,
      ),
    );
  await database.insert(notifications).values({
    userId,
    type: 'chat_message',
    payload: { ...payload, conversationId },
    href,
  });
}

export async function listNotifications(
  principal: WorkspacePrincipal,
  limit = 20,
): Promise<NotificationView[]> {
  const rows = await database
    .select()
    .from(notifications)
    .where(eq(notifications.userId, principal.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    payload: row.payload,
    href: row.href ?? undefined,
    read: row.readAt != null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getUnreadNotificationCount(
  principal: WorkspacePrincipal,
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, principal.id),
        isNull(notifications.readAt),
      ),
    );
  return row?.count ?? 0;
}

export async function markAllNotificationsRead(
  principal: WorkspacePrincipal,
): Promise<void> {
  await database
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, principal.id),
        isNull(notifications.readAt),
      ),
    );
}
