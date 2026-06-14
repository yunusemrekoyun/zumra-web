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
import { candidateProfiles, contacts } from './candidates';
import { mediaAssets } from './foundation';
import { privateLessonStudentRates, programs } from './programs';

export const enrollmentDraftStatusEnum = pgEnum('enrollment_draft_status', [
  'draft',
  'review_required',
  'ready',
  'completed',
  'cancelled',
]);

export const identityDocumentTypeEnum = pgEnum('identity_document_type', [
  'national_id',
  'passport',
]);

export const genderIdentityEnum = pgEnum('gender_identity', [
  'female',
  'male',
  'non_binary',
  'other',
  'prefer_not_to_say',
]);

export const enrollmentPartyRelationshipEnum = pgEnum(
  'enrollment_party_relationship',
  ['mother', 'father', 'sibling', 'other'],
);

export const courseModeEnum = pgEnum('course_mode', ['group', 'private']);

export const enrollmentDocumentStatusEnum = pgEnum(
  'enrollment_document_status',
  ['pending', 'verified', 'rejected'],
);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const discountTypeEnum = pgEnum('discount_type', [
  'none',
  'percentage',
  'fixed',
]);

export type EnrollmentPartyRole =
  | 'guardian'
  | 'payer'
  | 'promissory_debtor'
  | 'other';

export type ProgramSelectionSnapshot = {
  basePriceCents?: number;
  hourlyStudentPriceCents?: number;
  label?: string;
  language?: string;
  levels?: string[];
  privateLessonHours?: number;
  privateLessonRateId?: string;
  programId?: string;
  sectionId?: string;
  teacherName?: string;
  teacherUserId?: string;
  type?: 'group' | 'private';
};

export type SchedulePreference = {
  day: string;
  endTime: string;
  startTime: string;
};

export const enrollmentDrafts = pgTable(
  'enrollment_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'restrict' }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: enrollmentDraftStatusEnum('status').notNull().default('draft'),
    currentStep: integer('current_step').notNull().default(1),
    identityDocumentType:
      identityDocumentTypeEnum('identity_document_type'),
    identityDocumentEncrypted: text('identity_document_encrypted'),
    identityDocumentBlindIndex: text('identity_document_blind_index'),
    identityDocumentLastFour: text('identity_document_last_four'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    birthPlace: text('birth_place'),
    birthDate: timestamp('birth_date', { withTimezone: true }),
    gender: genderIdentityEnum('gender'),
    school: text('school'),
    primaryPhone: text('primary_phone'),
    secondaryPhone: text('secondary_phone'),
    email: text('email'),
    residenceAddress: text('residence_address'),
    studentIsContractParty: boolean('student_is_contract_party')
      .notNull()
      .default(true),
    instagramHandle: text('instagram_handle'),
    courseMode: courseModeEnum('course_mode'),
    programReferenceId: text('program_reference_id'),
    programId: uuid('program_id').references(() => programs.id, {
      onDelete: 'restrict',
    }),
    selectedTeacherUserId: text('selected_teacher_user_id').references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
    privateLessonLanguage: text('private_lesson_language'),
    privateLessonHours: integer('private_lesson_hours'),
    privateLessonRateId: uuid('private_lesson_rate_id').references(
      () => privateLessonStudentRates.id,
      { onDelete: 'restrict' },
    ),
    programSelection: jsonb('program_selection')
      .$type<ProgramSelectionSnapshot>()
      .notNull()
      .default({}),
    correctedSource: text('corrected_source'),
    registrationChannel: text('registration_channel'),
    listPriceCents: integer('list_price_cents'),
    discountType: discountTypeEnum('discount_type').notNull().default('none'),
    discountValue: integer('discount_value').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    discountAppliedByUserId: text('discount_applied_by_user_id').references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
    discountNote: text('discount_note'),
    finalPriceCents: integer('final_price_cents'),
    initialPaymentCents: integer('initial_payment_cents').notNull().default(0),
    currency: text('currency').notNull().default('TRY'),
    paymentMethod: text('payment_method'),
    installmentCount: integer('installment_count').notNull().default(1),
    financialNotes: text('financial_notes'),
    scheduleMode: text('schedule_mode').notNull().default('pending'),
    schedulePreferences: jsonb('schedule_preferences')
      .$type<SchedulePreference[]>()
      .notNull()
      .default([]),
    scheduleNotes: text('schedule_notes'),
    internalNotes: text('internal_notes'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    lastSavedAt: timestamp('last_saved_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('enrollment_drafts_one_active_candidate_idx')
      .on(table.candidateId)
      .where(
        sql`${table.status} in ('draft', 'review_required', 'ready')`,
      ),
    uniqueIndex('enrollment_drafts_identity_blind_index_unique')
      .on(table.identityDocumentBlindIndex)
      .where(sql`${table.identityDocumentBlindIndex} is not null`),
    index('enrollment_drafts_status_saved_idx').on(
      table.status,
      table.lastSavedAt,
    ),
    index('enrollment_drafts_created_by_idx').on(table.createdByUserId),
    index('enrollment_drafts_program_idx').on(table.programId),
    index('enrollment_drafts_teacher_idx').on(table.selectedTeacherUserId),
    check(
      'enrollment_drafts_current_step_check',
      sql`${table.currentStep} between 1 and 9`,
    ),
    check(
      'enrollment_drafts_currency_check',
      sql`${table.currency} = 'TRY'`,
    ),
    check(
      'enrollment_drafts_money_non_negative_check',
      sql`coalesce(${table.listPriceCents}, 0) >= 0
        and ${table.discountValue} >= 0
        and ${table.discountCents} >= 0
        and coalesce(${table.finalPriceCents}, 0) >= 0
        and ${table.initialPaymentCents} >= 0`,
    ),
    check(
      'enrollment_drafts_discount_value_check',
      sql`(${table.discountType} = 'percentage' and ${table.discountValue} <= 10000)
        or ${table.discountType} <> 'percentage'`,
    ),
    check(
      'enrollment_drafts_private_lesson_fields_check',
      sql`${table.courseMode} <> 'private'
        or ${table.programId} is null
        or (
          ${table.selectedTeacherUserId} is not null
          and ${table.privateLessonLanguage} is not null
          and ${table.privateLessonHours} > 0
          and ${table.privateLessonRateId} is not null
        )`,
    ),
    check(
      'enrollment_drafts_installment_count_check',
      sql`${table.installmentCount} between 1 and 120`,
    ),
  ],
);

export const enrollmentParties = pgTable(
  'enrollment_parties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => enrollmentDrafts.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    relationship: enrollmentPartyRelationshipEnum('relationship').notNull(),
    relationshipOther: text('relationship_other'),
    roles: jsonb('roles')
      .$type<EnrollmentPartyRole[]>()
      .notNull()
      .default([]),
    identityDocumentType:
      identityDocumentTypeEnum('identity_document_type'),
    identityDocumentEncrypted: text('identity_document_encrypted'),
    identityDocumentBlindIndex: text('identity_document_blind_index'),
    identityDocumentLastFour: text('identity_document_last_four'),
    phone: text('phone'),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('enrollment_parties_draft_idx').on(table.draftId),
    index('enrollment_parties_identity_blind_idx').on(
      table.identityDocumentBlindIndex,
    ),
    check(
      'enrollment_parties_roles_not_empty_check',
      sql`jsonb_array_length(${table.roles}) >= 1`,
    ),
  ],
);

export const enrollmentDocuments = pgTable(
  'enrollment_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => enrollmentDrafts.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    label: text('label').notNull(),
    status: enrollmentDocumentStatusEnum('status')
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('enrollment_documents_draft_media_unique').on(
      table.draftId,
      table.mediaAssetId,
    ),
    index('enrollment_documents_draft_type_idx').on(table.draftId, table.type),
  ],
);

export const studentProfiles = pgTable(
  'student_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'restrict' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'restrict' }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('active'),
    currentLevel: text('current_level'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('student_profiles_candidate_unique').on(table.candidateId),
    uniqueIndex('student_profiles_contact_unique').on(table.contactId),
    uniqueIndex('student_profiles_user_unique')
      .on(table.userId)
      .where(sql`${table.userId} is not null`),
    index('student_profiles_status_idx').on(table.status),
  ],
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'restrict' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'restrict' }),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => enrollmentDrafts.id, { onDelete: 'restrict' }),
    registeredByUserId: text('registered_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: enrollmentStatusEnum('status').notNull().default('active'),
    courseMode: courseModeEnum('course_mode').notNull(),
    programReferenceId: text('program_reference_id'),
    programId: uuid('program_id').references(() => programs.id, {
      onDelete: 'restrict',
    }),
    selectedTeacherUserId: text('selected_teacher_user_id').references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
    privateLessonRateId: uuid('private_lesson_rate_id').references(
      () => privateLessonStudentRates.id,
      { onDelete: 'restrict' },
    ),
    programSelection: jsonb('program_selection')
      .$type<ProgramSelectionSnapshot>()
      .notNull()
      .default({}),
    currency: text('currency').notNull().default('TRY'),
    finalPriceCents: integer('final_price_cents').notNull(),
    financialSnapshot: jsonb('financial_snapshot')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    scheduleSnapshot: jsonb('schedule_snapshot')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('enrollments_draft_unique').on(table.draftId),
    index('enrollments_student_status_idx').on(table.studentId, table.status),
    index('enrollments_candidate_idx').on(table.candidateId),
    index('enrollments_program_idx').on(table.programId),
    index('enrollments_teacher_idx').on(table.selectedTeacherUserId),
    check('enrollments_currency_check', sql`${table.currency} = 'TRY'`),
    check(
      'enrollments_final_price_non_negative_check',
      sql`${table.finalPriceCents} >= 0`,
    ),
  ],
);
