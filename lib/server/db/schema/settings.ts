import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const workspaceSettings = pgTable('workspace_settings', {
  key: text('key').primaryKey(),
  // Mixed-type settings store: numeric tuning knobs (e.g. joinLeadMinutes) plus
  // string enums (e.g. mailMode). jsonb holds either; the service layer
  // validates per key. See lib/server/services/settings.ts.
  value: jsonb('value').$type<number | string>().notNull(),
  updatedByUserId: text('updated_by_user_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
