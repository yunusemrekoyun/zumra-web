import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { instructorProfiles } from './instructors';

export const programKindEnum = pgEnum('program_kind', ['group', 'private']);
export const programBranchStatusEnum = pgEnum('program_branch_status', [
  'draft',
  'enrollment_open',
  'enrollment_closed',
  'in_progress',
  'completed',
  'cancelled',
]);

export const programs = pgTable(
  'programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    systemKey: text('system_key'),
    name: text('name').notNull(),
    description: text('description'),
    kind: programKindEnum('kind').notNull().default('group'),
    language: text('language'),
    levels: jsonb('levels').$type<string[]>().notNull().default([]),
    listPriceCents: integer('list_price_cents'),
    currency: text('currency').notNull().default('TRY'),
    active: boolean('active').notNull().default(true),
    systemManaged: boolean('system_managed').notNull().default(false),
    publicVisible: boolean('public_visible').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    marketingIcon: text('marketing_icon'),
    popular: boolean('popular').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('programs_system_key_unique')
      .on(table.systemKey)
      .where(sql`${table.systemKey} is not null`),
    index('programs_active_kind_idx').on(table.active, table.kind),
    index('programs_language_idx').on(table.language),
    index('programs_public_visible_idx').on(
      table.publicVisible,
      table.displayOrder,
    ),
    check('programs_currency_check', sql`${table.currency} = 'TRY'`),
    check(
      'programs_list_price_non_negative_check',
      sql`${table.listPriceCents} is null or ${table.listPriceCents} >= 0`,
    ),
    check(
      'programs_group_fields_check',
      sql`${table.kind} <> 'group'
        or (
          ${table.language} is not null
          and ${table.listPriceCents} is not null
          and jsonb_array_length(${table.levels}) >= 1
        )`,
    ),
    check(
      'programs_creator_check',
      sql`${table.systemManaged} = true or ${table.createdByUserId} is not null`,
    ),
  ],
);

export const programBranches = pgTable(
  'program_branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    status: programBranchStatusEnum('status')
      .notNull()
      .default('enrollment_open'),
    plannedStartDate: date('planned_start_date').notNull(),
    plannedEndDate: date('planned_end_date').notNull(),
    timezone: text('timezone').notNull().default('Europe/Istanbul'),
    minimumCapacity: integer('minimum_capacity').notNull().default(1),
    maximumCapacity: integer('maximum_capacity').notNull(),
    instructorProfileId: uuid('instructor_profile_id').references(
      () => instructorProfiles.id,
      {
        onDelete: 'set null',
      },
    ),
    notes: text('notes'),
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
    uniqueIndex('program_branches_program_name_unique').on(
      table.programId,
      table.name,
    ),
    index('program_branches_program_status_idx').on(
      table.programId,
      table.status,
    ),
    index('program_branches_instructor_idx').on(table.instructorProfileId),
    index('program_branches_dates_idx').on(
      table.plannedStartDate,
      table.plannedEndDate,
    ),
    check(
      'program_branches_capacity_check',
      sql`${table.minimumCapacity} >= 1
        and ${table.maximumCapacity} >= ${table.minimumCapacity}`,
    ),
    check(
      'program_branches_date_check',
      sql`${table.plannedEndDate} >= ${table.plannedStartDate}`,
    ),
    check(
      'program_branches_timezone_check',
      sql`length(trim(${table.timezone})) > 0`,
    ),
  ],
);

export const privateLessonStudentRates = pgTable(
  'private_lesson_student_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorProfileId: uuid('instructor_profile_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'restrict' }),
    language: text('language').notNull(),
    hourlyPriceCents: integer('hourly_price_cents').notNull(),
    currency: text('currency').notNull().default('TRY'),
    active: boolean('active').notNull().default(true),
    effectiveFrom: timestamp('effective_from', { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
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
    uniqueIndex('private_lesson_rates_one_current_instructor_language_idx')
      .on(table.instructorProfileId, table.language)
      .where(
        sql`${table.active} = true and ${table.effectiveUntil} is null`,
      ),
    index('private_lesson_rates_lookup_idx').on(
      table.instructorProfileId,
      table.language,
      table.active,
    ),
    check(
      'private_lesson_rates_price_positive_check',
      sql`${table.hourlyPriceCents} > 0`,
    ),
    check(
      'private_lesson_rates_currency_check',
      sql`${table.currency} = 'TRY'`,
    ),
    check(
      'private_lesson_rates_period_check',
      sql`${table.effectiveUntil} is null
        or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);
