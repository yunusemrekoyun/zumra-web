import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { programBranches } from './programs';

// Lives here (not in enrollments.ts) so the draft table can hold real foreign
// keys to the package tables without an import cycle: enrollments → pricing →
// (auth, programs) is acyclic.
export const discountTypeEnum = pgEnum('discount_type', [
  'none',
  'percentage',
  'fixed',
]);

export const discountPackageScopeEnum = pgEnum('discount_package_scope', [
  'branch',
  'private',
]);

// Admin-defined discount presets picked in the enrollment wizard: branch
// packages apply to that branch's group enrollments, private packages to
// one-on-one enrollments. Optional validity dates turn a package into a
// campaign. Anything outside these presets is a "manual" discount, which
// requires a note and pings the admins.
export const discountPackages = pgTable(
  'discount_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    scope: discountPackageScopeEnum('scope').notNull(),
    branchId: uuid('branch_id').references(() => programBranches.id, {
      onDelete: 'cascade',
    }),
    discountType: discountTypeEnum('discount_type').notNull(),
    discountValue: integer('discount_value').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    note: text('note'),
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
    index('discount_packages_branch_idx').on(table.branchId),
    index('discount_packages_scope_idx').on(table.scope, table.active),
    check(
      'discount_packages_scope_check',
      sql`(${table.scope} = 'branch' and ${table.branchId} is not null)
        or (${table.scope} = 'private' and ${table.branchId} is null)`,
    ),
    check(
      'discount_packages_value_check',
      sql`(${table.discountType} = 'percentage' and ${table.discountValue} between 1 and 10000)
        or (${table.discountType} = 'fixed' and ${table.discountValue} > 0)`,
    ),
    check(
      'discount_packages_validity_check',
      sql`${table.endsAt} is null or ${table.startsAt} is null or ${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      'discount_packages_name_check',
      sql`length(trim(${table.name})) >= 2`,
    ),
  ],
);

// The one-on-one price catalog ("ana paketler"): total package price and the
// hourly rate are defined together, instructor-independent. Picking one in the
// wizard fills the hours and overrides the hourly-rate-derived base price.
export const privateLessonPackages = pgTable(
  'private_lesson_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    language: text('language').notNull(),
    hours: integer('hours').notNull(),
    totalPriceCents: integer('total_price_cents').notNull(),
    hourlyPriceCents: integer('hourly_price_cents').notNull(),
    currency: text('currency').notNull().default('TRY'),
    active: boolean('active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    note: text('note'),
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
    index('private_lesson_packages_language_idx').on(
      table.language,
      table.active,
    ),
    check(
      'private_lesson_packages_currency_check',
      sql`${table.currency} = 'TRY'`,
    ),
    check(
      'private_lesson_packages_values_check',
      sql`${table.hours} > 0
        and ${table.totalPriceCents} > 0
        and ${table.hourlyPriceCents} > 0`,
    ),
    check(
      'private_lesson_packages_name_check',
      sql`length(trim(${table.name})) >= 2`,
    ),
  ],
);
