import { sql } from 'drizzle-orm';
import {
  check,
  date,
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
import { enrollments } from './enrollments';
import { mediaAssets } from './foundation';
import { instructorProfiles } from './instructors';
import { programBranches } from './programs';

export const commissionScopeEnum = pgEnum('commission_scope', [
  'branch',
  'instructor_private',
]);

export const installmentStatusEnum = pgEnum('installment_status', [
  'pending',
  'partial',
  'paid',
]);

export const paymentRecordStatusEnum = pgEnum('payment_record_status', [
  'reported',
  'confirmed',
  'rejected',
]);

// Students wire tuition straight to the teacher's bank account, so the IBAN is
// financial history: rows are immutable, a change archives the old row and
// inserts a new one (admin only). Payment records reference the row that was
// active when the payment was reported.
export const instructorBankAccounts = pgTable(
  'instructor_bank_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'restrict' }),
    ibanEncrypted: text('iban_encrypted').notNull(),
    ibanBlindIndex: text('iban_blind_index').notNull(),
    ibanLastFour: text('iban_last_four').notNull(),
    holderName: text('holder_name'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('instructor_bank_accounts_active_unique')
      .on(table.instructorId)
      .where(sql`${table.archivedAt} is null`),
    index('instructor_bank_accounts_instructor_idx').on(table.instructorId),
    index('instructor_bank_accounts_blind_index_idx').on(table.ibanBlindIndex),
  ],
);

// teacherShareBasisPoints is the TEACHER's cut; Zümra's share is the remainder
// (10000 - value). Group lessons rate per branch, private lessons per
// instructor — both managed from the single admin commissions screen.
export const commissionRates = pgTable(
  'commission_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: commissionScopeEnum('scope').notNull(),
    branchId: uuid('branch_id').references(() => programBranches.id, {
      onDelete: 'cascade',
    }),
    instructorId: uuid('instructor_id').references(
      () => instructorProfiles.id,
      { onDelete: 'cascade' },
    ),
    teacherShareBasisPoints: integer('teacher_share_basis_points').notNull(),
    note: text('note'),
    updatedByUserId: text('updated_by_user_id')
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
    uniqueIndex('commission_rates_branch_unique')
      .on(table.branchId)
      .where(sql`${table.scope} = 'branch'`),
    uniqueIndex('commission_rates_instructor_unique')
      .on(table.instructorId)
      .where(sql`${table.scope} = 'instructor_private'`),
    check(
      'commission_rates_scope_check',
      sql`(${table.scope} = 'branch' and ${table.branchId} is not null and ${table.instructorId} is null)
        or (${table.scope} = 'instructor_private' and ${table.instructorId} is not null and ${table.branchId} is null)`,
    ),
    check(
      'commission_rates_share_check',
      sql`${table.teacherShareBasisPoints} >= 0 and ${table.teacherShareBasisPoints} <= 10000`,
    ),
  ],
);

// The installment plan agreed at enrollment (entered by admin/advisors, a
// default plan is generated when the enrollment completes). paidCents rolls up
// confirmed payment records; status is maintained in the same transaction.
export const enrollmentInstallments = pgTable(
  'enrollment_installments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    label: text('label'),
    amountCents: integer('amount_cents').notNull(),
    paidCents: integer('paid_cents').notNull().default(0),
    currency: text('currency').notNull().default('TRY'),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    status: installmentStatusEnum('status').notNull().default('pending'),
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
    uniqueIndex('enrollment_installments_sequence_unique').on(
      table.enrollmentId,
      table.sequence,
    ),
    index('enrollment_installments_enrollment_idx').on(table.enrollmentId),
    index('enrollment_installments_due_idx').on(table.dueDate, table.status),
    check(
      'enrollment_installments_currency_check',
      sql`${table.currency} = 'TRY'`,
    ),
    check(
      'enrollment_installments_amounts_check',
      sql`${table.sequence} >= 1
        and ${table.amountCents} > 0
        and ${table.paidCents} >= 0`,
    ),
  ],
);

// One cash hand-over from a teacher covering Zümra's share of the selected
// confirmed payments (payment_records.settlement_id points here).
export const teacherSettlements = pgTable(
  'teacher_settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'restrict' }),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').notNull().default('TRY'),
    note: text('note'),
    receivedByUserId: text('received_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('teacher_settlements_instructor_idx').on(table.instructorId),
    check('teacher_settlements_currency_check', sql`${table.currency} = 'TRY'`),
    check('teacher_settlements_total_check', sql`${table.totalCents} >= 0`),
  ],
);

// The single ledger. Students report transfers (status reported), the teacher
// confirms with the receipt (confirmed) or rejects with a reason; staff direct
// entries land as confirmed immediately. Commission is snapshotted at
// confirmation so later rate changes never rewrite history.
export const paymentRecords = pgTable(
  'payment_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'restrict' }),
    installmentId: uuid('installment_id').references(
      () => enrollmentInstallments.id,
      { onDelete: 'restrict' },
    ),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'restrict' }),
    bankAccountId: uuid('bank_account_id').references(
      () => instructorBankAccounts.id,
      { onDelete: 'restrict' },
    ),
    status: paymentRecordStatusEnum('status').notNull().default('reported'),
    declaredAmountCents: integer('declared_amount_cents'),
    amountCents: integer('amount_cents'),
    currency: text('currency').notNull().default('TRY'),
    method: text('method'),
    studentNote: text('student_note'),
    reviewNote: text('review_note'),
    receiptMediaAssetId: uuid('receipt_media_asset_id').references(
      () => mediaAssets.id,
      { onDelete: 'restrict' },
    ),
    reportedByUserId: text('reported_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reportedAt: timestamp('reported_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    teacherShareBasisPoints: integer('teacher_share_basis_points'),
    zumraShareCents: integer('zumra_share_cents'),
    settlementId: uuid('settlement_id').references(
      () => teacherSettlements.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One open report per installment: the service checks first, but only this
    // index makes the rule hold under concurrent requests.
    uniqueIndex('payment_records_open_report_unique')
      .on(table.installmentId)
      .where(sql`${table.status} = 'reported'`),
    index('payment_records_enrollment_idx').on(table.enrollmentId),
    index('payment_records_instructor_status_idx').on(
      table.instructorId,
      table.status,
    ),
    index('payment_records_status_reported_idx').on(
      table.status,
      table.reportedAt,
    ),
    index('payment_records_unsettled_idx')
      .on(table.instructorId)
      .where(
        sql`${table.settlementId} is null and ${table.status} = 'confirmed'`,
      ),
    check('payment_records_currency_check', sql`${table.currency} = 'TRY'`),
    check(
      'payment_records_amounts_check',
      sql`(${table.declaredAmountCents} is null or ${table.declaredAmountCents} >= 0)
        and (${table.amountCents} is null or ${table.amountCents} > 0)
        and (${table.zumraShareCents} is null or ${table.zumraShareCents} >= 0)
        and (${table.teacherShareBasisPoints} is null
          or (${table.teacherShareBasisPoints} >= 0 and ${table.teacherShareBasisPoints} <= 10000))`,
    ),
    check(
      'payment_records_confirmed_check',
      sql`${table.status} <> 'confirmed'
        or (${table.amountCents} is not null and ${table.reviewedByUserId} is not null)`,
    ),
  ],
);
