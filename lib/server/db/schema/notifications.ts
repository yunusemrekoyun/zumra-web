import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const notificationTypeEnum = pgEnum('notification_type', [
  'assignment_assigned',
  'assignment_submitted',
  'assignment_graded',
  'chat_message',
  'lead_received',
]);

// In-app notifications (the bell). Distinct from notification_outbox, which is
// the outbound email/whatsapp dispatcher. The title is rendered client-side
// from type + payload so it respects the recipient's locale.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    href: text('href'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notifications_user_created_idx').on(table.userId, table.createdAt),
  ],
);
