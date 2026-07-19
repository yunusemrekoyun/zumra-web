import 'server-only';

import { and, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  advisorTasks,
  candidateProfiles,
  contacts,
  notifications,
  users,
} from '@/lib/server/db/schema';
import { createNotifications } from '@/lib/server/services/notification-feed';
import { notificationService } from '@/lib/server/services/notifications';

// Hourly sweep: open advisor tasks whose due time has arrived get one in-app
// ping + one email per day to their assignee until handled.
export async function sweepTaskDueReminders() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const dueTasks = await database
    .select({
      assigneeEmail: users.email,
      assigneeName: users.name,
      assigneeUserId: advisorTasks.assigneeUserId,
      candidateFirstName: contacts.firstName,
      candidateLastName: contacts.lastName,
      dueAt: advisorTasks.dueAt,
      id: advisorTasks.id,
      title: advisorTasks.title,
    })
    .from(advisorTasks)
    .innerJoin(users, eq(users.id, advisorTasks.assigneeUserId))
    .leftJoin(
      candidateProfiles,
      eq(candidateProfiles.id, advisorTasks.candidateId),
    )
    .leftJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .where(
      and(
        eq(advisorTasks.status, 'open'),
        isNotNull(advisorTasks.assigneeUserId),
        lte(advisorTasks.dueAt, now),
        // Dedupe in SQL so the LIMIT always points at tasks that have not
        // been pinged today — a large backlog drains across hourly runs.
        sql`not exists (
          select 1 from ${notifications}
          where ${notifications.type} = 'task_due'
            and ${notifications.createdAt} >= ${today}
            and ${notifications.payload}->>'taskId' = ${advisorTasks.id}::text
        )`,
      ),
    )
    .orderBy(advisorTasks.dueAt)
    .limit(200);

  for (const task of dueTasks) {
    if (!task.assigneeUserId) {
      continue;
    }

    const title =
      task.title?.trim() ||
      `${task.candidateFirstName ?? ''} ${task.candidateLastName ?? ''}`.trim() ||
      '';

    await createNotifications([
      {
        href: '/danisman/gorevlerim',
        payload: { taskId: task.id, title },
        type: 'task_due',
        userId: task.assigneeUserId,
      },
    ]);

    await notificationService.enqueue({
      channel: 'email',
      idempotencyKey: `task-due:${task.id}:${now.toISOString().slice(0, 10)}`,
      locale: 'tr',
      payload: { name: task.assigneeName, task: title },
      recipient: task.assigneeEmail,
      templateKey: 'task-reminder',
    });
  }
}
