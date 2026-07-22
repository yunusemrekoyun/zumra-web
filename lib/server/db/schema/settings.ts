import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const workspaceSettings = pgTable('workspace_settings', {
  key: text('key').primaryKey(),
  // Mixed-type settings store: numeric tuning knobs (e.g. joinLeadMinutes),
  // string enums (e.g. mailMode) and boolean flags (e.g.
  // loginVerificationEnabled). jsonb holds any of them; the service layer
  // validates per key. See lib/server/services/settings.ts.
  value: jsonb('value').$type<number | string | boolean>().notNull(),
  updatedByUserId: text('updated_by_user_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
