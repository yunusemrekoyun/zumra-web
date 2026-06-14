import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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

export const programKindEnum = pgEnum('program_kind', ['group', 'private']);

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

export const privateLessonStudentRates = pgTable(
  'private_lesson_student_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teacherUserId: text('teacher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
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
    uniqueIndex('private_lesson_rates_one_current_teacher_language_idx')
      .on(table.teacherUserId, table.language)
      .where(
        sql`${table.active} = true and ${table.effectiveUntil} is null`,
      ),
    index('private_lesson_rates_lookup_idx').on(
      table.teacherUserId,
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
