import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { mediaAssets, userInvitations } from './foundation';

export const instructorStatusEnum = pgEnum('instructor_status', [
  'draft',
  'active',
  'on_leave',
  'inactive',
  'archived',
]);

export const instructorDocumentKindEnum = pgEnum(
  'instructor_document_kind',
  ['certificate', 'identity', 'contract', 'other'],
);

export const instructorProfiles = pgTable(
  'instructor_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    status: instructorStatusEnum('status').notNull().default('active'),
    biography: text('biography'),
    specialties: jsonb('specialties').$type<string[]>().notNull().default([]),
    internalNotes: text('internal_notes'),
    photoMediaAssetId: uuid('photo_media_asset_id').references(
      () => mediaAssets.id,
      { onDelete: 'set null' },
    ),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('instructor_profiles_user_unique')
      .on(table.userId)
      .where(sql`${table.userId} is not null`),
    uniqueIndex('instructor_profiles_active_email_unique')
      .on(table.email)
      .where(sql`${table.status} <> 'archived'`),
    uniqueIndex('instructor_profiles_active_phone_unique')
      .on(table.phone)
      .where(sql`${table.status} <> 'archived'`),
    index('instructor_profiles_status_name_idx').on(
      table.status,
      table.lastName,
      table.firstName,
    ),
    check(
      'instructor_profiles_name_check',
      sql`length(trim(${table.firstName})) >= 2
        and length(trim(${table.lastName})) >= 2`,
    ),
    check(
      'instructor_profiles_phone_check',
      sql`length(trim(${table.phone})) >= 7`,
    ),
  ],
);

export const instructorLanguageCompetencies = pgTable(
  'instructor_language_competencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    levels: jsonb('levels').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('instructor_languages_instructor_language_unique').on(
      table.instructorId,
      table.language,
    ),
    index('instructor_languages_language_idx').on(table.language),
    check(
      'instructor_languages_levels_check',
      sql`jsonb_array_length(${table.levels}) >= 1`,
    ),
  ],
);

export const instructorDocuments = pgTable(
  'instructor_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    kind: instructorDocumentKindEnum('kind').notNull().default('other'),
    label: text('label').notNull(),
    notes: text('notes'),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('instructor_documents_media_unique').on(table.mediaAssetId),
    index('instructor_documents_instructor_idx').on(table.instructorId),
  ],
);

export const instructorAccountInvitations = pgTable(
  'instructor_account_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'cascade' }),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => userInvitations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('instructor_account_invitation_unique').on(
      table.invitationId,
    ),
    index('instructor_account_instructor_idx').on(table.instructorId),
  ],
);
