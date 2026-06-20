import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const workspaceSettings = pgTable('workspace_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<number>().notNull(),
  updatedByUserId: text('updated_by_user_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
