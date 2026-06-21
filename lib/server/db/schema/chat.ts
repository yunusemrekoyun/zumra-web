import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { assignments } from './assignments';
import { users } from './auth';
import { studentProfiles } from './enrollments';
import { mediaAssets } from './foundation';
import { instructorProfiles } from './instructors';

export const conversationSenderRoleEnum = pgEnum('conversation_sender_role', [
  'student',
  'instructor',
]);

// One conversation per (student, instructor) pair — the relationship-level
// channel. Read state is tracked per side (last-read timestamp) so unread
// counts are cheap.
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    instructorProfileId: uuid('instructor_profile_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    studentLastReadAt: timestamp('student_last_read_at', {
      withTimezone: true,
    }),
    instructorLastReadAt: timestamp('instructor_last_read_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('conversations_pair_unique').on(
      table.studentProfileId,
      table.instructorProfileId,
    ),
    index('conversations_student_idx').on(table.studentProfileId),
    index('conversations_instructor_idx').on(table.instructorProfileId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderRole: conversationSenderRoleEnum('sender_role').notNull(),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body'),
    // Optional context link — a message can reference an assignment so the UI
    // can render an inline card in the stream.
    assignmentId: uuid('assignment_id').references(() => assignments.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('messages_conversation_created_idx').on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('message_attachments_unique').on(
      table.messageId,
      table.mediaAssetId,
    ),
    index('message_attachments_message_idx').on(table.messageId),
  ],
);
