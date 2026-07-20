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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { candidateProfiles } from './candidates';
import { instructorProfiles } from './instructors';
import { programBranches } from './programs';

export const discoveryFeeScopeEnum = pgEnum('discovery_fee_scope', [
  'branch',
  'instructor',
]);

export const discoveryLessonStatusEnum = pgEnum('discovery_lesson_status', [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
]);

export const discoveryPaymentStatusEnum = pgEnum('discovery_payment_status', [
  'free',
  'awaiting',
  'reported',
  'received',
]);

// Admin-configured discovery/trial lesson fee per branch or per instructor.
// feeCents 0 means the trial is free for that target.
export const discoveryFees = pgTable(
  'discovery_fees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: discoveryFeeScopeEnum('scope').notNull(),
    branchId: uuid('branch_id').references(() => programBranches.id, {
      onDelete: 'cascade',
    }),
    instructorProfileId: uuid('instructor_profile_id').references(
      () => instructorProfiles.id,
      { onDelete: 'cascade' },
    ),
    feeCents: integer('fee_cents').notNull().default(0),
    active: boolean('active').notNull().default(true),
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
    uniqueIndex('discovery_fees_branch_unique')
      .on(table.branchId)
      .where(sql`${table.scope} = 'branch' and ${table.active} = true`),
    uniqueIndex('discovery_fees_instructor_unique')
      .on(table.instructorProfileId)
      .where(sql`${table.scope} = 'instructor' and ${table.active} = true`),
    check(
      'discovery_fees_target_check',
      sql`(${table.scope} = 'branch' and ${table.branchId} is not null and ${table.instructorProfileId} is null)
        or (${table.scope} = 'instructor' and ${table.instructorProfileId} is not null and ${table.branchId} is null)`,
    ),
    check('discovery_fees_fee_check', sql`${table.feeCents} >= 0`),
  ],
);

// A scheduled discovery/trial lesson for a candidate. Payment (when the fee is
// non-zero) follows the bank-transfer ledger flow: the candidate wires the
// instructor's IBAN and the payment is tracked here — never offset against a
// later enrollment.
export const discoveryLessons = pgTable(
  'discovery_lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'restrict' }),
    instructorProfileId: uuid('instructor_profile_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id').references(() => programBranches.id, {
      onDelete: 'set null',
    }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    status: discoveryLessonStatusEnum('status').notNull().default('scheduled'),
    feeCents: integer('fee_cents').notNull().default(0),
    paymentStatus: discoveryPaymentStatusEnum('payment_status')
      .notNull()
      .default('free'),
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
    index('discovery_lessons_candidate_idx').on(table.candidateId),
    index('discovery_lessons_instructor_scheduled_idx').on(
      table.instructorProfileId,
      table.scheduledAt,
    ),
    index('discovery_lessons_status_idx').on(table.status),
    check(
      'discovery_lessons_duration_check',
      sql`${table.durationMinutes} between 15 and 180`,
    ),
    check('discovery_lessons_fee_check', sql`${table.feeCents} >= 0`),
    check(
      'discovery_lessons_payment_check',
      sql`(${table.feeCents} = 0 and ${table.paymentStatus} = 'free')
        or (${table.feeCents} > 0 and ${table.paymentStatus} <> 'free')`,
    ),
  ],
);
