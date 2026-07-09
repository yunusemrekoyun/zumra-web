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
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { programs } from './programs';

export const candidateStageEnum = pgEnum('candidate_stage', [
  'new',
  'contacted',
  'qualified',
  'offer_pending',
  'enrolled',
  'lost',
]);

export const inquiryStatusEnum = pgEnum('inquiry_status', [
  'open',
  'completed',
  'enrolled',
  'closed',
]);

export const assessmentVersionStatusEnum = pgEnum(
  'assessment_version_status',
  ['draft', 'published', 'archived'],
);

export const assessmentAttemptStatusEnum = pgEnum(
  'assessment_attempt_status',
  ['not_started', 'in_progress', 'completed'],
);

export const appointmentRequestStatusEnum = pgEnum(
  'appointment_request_status',
  ['requested', 'scheduled', 'completed', 'cancelled', 'no_show'],
);

export type LocalizedText = {
  en: string;
  tr: string;
};

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phone: text('phone'),
    normalizedPhone: text('normalized_phone'),
    phoneOwner: text('phone_owner'),
    isMinor: boolean('is_minor').notNull().default(false),
    learningGoal: text('learning_goal'),
    preferredContactChannel: text('preferred_contact_channel'),
    city: text('city'),
    timezone: text('timezone'),
    lessonModel: text('lesson_model'),
    contactWindow: text('contact_window'),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('contacts_normalized_email_unique').on(table.normalizedEmail),
    index('contacts_normalized_phone_idx').on(table.normalizedPhone),
    index('contacts_created_idx').on(table.createdAt),
  ],
);

export const candidateProfiles = pgTable(
  'candidate_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'restrict' }),
    advisorId: text('advisor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    stage: candidateStageEnum('stage').notNull().default('new'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
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
    uniqueIndex('candidate_profiles_contact_unique').on(table.contactId),
    index('candidate_profiles_stage_activity_idx').on(
      table.stage,
      table.lastActivityAt,
    ),
    index('candidate_profiles_advisor_idx').on(table.advisorId),
  ],
);

export const candidateInquiries = pgTable(
  'candidate_inquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'restrict' }),
    language: text('language').notNull(),
    programId: uuid('program_id').references(() => programs.id, {
      onDelete: 'set null',
    }),
    source: text('source').notNull().default('public_level_test'),
    locale: text('locale').notNull(),
    status: inquiryStatusEnum('status').notNull().default('open'),
    formVersion: text('form_version').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    referrer: text('referrer'),
    attribution: jsonb('attribution')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    profileCompletedAt: timestamp('profile_completed_at', {
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
    uniqueIndex('candidate_inquiries_idempotency_unique').on(
      table.idempotencyKey,
    ),
    index('candidate_inquiries_candidate_created_idx').on(
      table.candidateId,
      table.createdAt,
    ),
    index('candidate_inquiries_program_idx').on(table.programId),
    index('candidate_inquiries_language_status_idx').on(
      table.language,
      table.status,
    ),
  ],
);

export const candidateConsents = pgTable(
  'candidate_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'restrict' }),
    inquiryId: uuid('inquiry_id')
      .notNull()
      .references(() => candidateInquiries.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    version: text('version').notNull(),
    accepted: boolean('accepted').notNull(),
    locale: text('locale').notNull(),
    textSnapshot: text('text_snapshot').notNull(),
    maskedIp: text('masked_ip'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('candidate_consents_inquiry_type_version_unique').on(
      table.inquiryId,
      table.type,
      table.version,
    ),
    index('candidate_consents_contact_idx').on(table.contactId),
  ],
);

export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    language: text('language').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assessments_slug_unique').on(table.slug),
    index('assessments_language_active_idx').on(table.language, table.active),
  ],
);

export const assessmentVersions = pgTable(
  'assessment_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    status: assessmentVersionStatusEnum('status')
      .notNull()
      .default('draft'),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    questionCount: integer('question_count').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assessment_versions_assessment_version_unique').on(
      table.assessmentId,
      table.version,
    ),
    uniqueIndex('assessment_versions_one_published_idx')
      .on(table.assessmentId)
      .where(sql`${table.status} = 'published'`),
    index('assessment_versions_status_idx').on(table.status),
    check(
      'assessment_versions_question_count_check',
      sql`${table.questionCount} between 1 and 100`,
    ),
  ],
);

export const assessmentQuestions = pgTable(
  'assessment_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    versionId: uuid('version_id')
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: 'restrict' }),
    order: integer('order').notNull(),
    level: text('level').notNull(),
    topic: text('topic').notNull(),
    difficulty: integer('difficulty').notNull(),
    prompt: jsonb('prompt').$type<LocalizedText>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assessment_questions_version_order_unique').on(
      table.versionId,
      table.order,
    ),
    index('assessment_questions_version_level_idx').on(
      table.versionId,
      table.level,
    ),
    check(
      'assessment_questions_order_check',
      sql`${table.order} >= 1`,
    ),
    check(
      'assessment_questions_difficulty_check',
      sql`${table.difficulty} between 1 and 5`,
    ),
  ],
);

export const assessmentOptions = pgTable(
  'assessment_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => assessmentQuestions.id, { onDelete: 'restrict' }),
    order: integer('order').notNull(),
    label: jsonb('label').$type<LocalizedText>().notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (table) => [
    uniqueIndex('assessment_options_question_order_unique').on(
      table.questionId,
      table.order,
    ),
    index('assessment_options_question_idx').on(table.questionId),
  ],
);

export const assessmentAttempts = pgTable(
  'assessment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inquiryId: uuid('inquiry_id')
      .notNull()
      .references(() => candidateInquiries.id, { onDelete: 'restrict' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => assessmentVersions.id, { onDelete: 'restrict' }),
    continuationTokenHash: text('continuation_token_hash').notNull(),
    status: assessmentAttemptStatusEnum('status')
      .notNull()
      .default('not_started'),
    currentQuestionOrder: integer('current_question_order')
      .notNull()
      .default(1),
    score: integer('score'),
    resultLevel: text('result_level'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    profileCompletedAt: timestamp('profile_completed_at', {
      withTimezone: true,
    }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
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
    uniqueIndex('assessment_attempts_continuation_token_unique').on(
      table.continuationTokenHash,
    ),
    index('assessment_attempts_inquiry_created_idx').on(
      table.inquiryId,
      table.createdAt,
    ),
    index('assessment_attempts_status_expiry_idx').on(
      table.status,
      table.expiresAt,
    ),
    check(
      'assessment_attempts_current_order_check',
      sql`${table.currentQuestionOrder} >= 1`,
    ),
  ],
);

export const assessmentAnswers = pgTable(
  'assessment_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => assessmentAttempts.id, { onDelete: 'restrict' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => assessmentQuestions.id, { onDelete: 'restrict' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => assessmentOptions.id, { onDelete: 'restrict' }),
    isCorrect: boolean('is_correct').notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assessment_answers_attempt_question_unique').on(
      table.attemptId,
      table.questionId,
    ),
    index('assessment_answers_attempt_idx').on(table.attemptId),
  ],
);

export const assessmentResults = pgTable(
  'assessment_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => assessmentAttempts.id, { onDelete: 'restrict' }),
    score: integer('score').notNull(),
    correctCount: integer('correct_count').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    level: text('level').notNull(),
    levelBreakdown: jsonb('level_breakdown')
      .$type<Record<string, { correct: number; total: number }>>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assessment_results_attempt_unique').on(table.attemptId),
    check(
      'assessment_results_score_check',
      sql`${table.score} between 0 and 100`,
    ),
  ],
);

export const appointmentRequests = pgTable(
  'appointment_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'restrict' }),
    inquiryId: uuid('inquiry_id')
      .notNull()
      .references(() => candidateInquiries.id, { onDelete: 'restrict' }),
    assessmentResultId: uuid('assessment_result_id').references(
      () => assessmentResults.id,
      { onDelete: 'set null' },
    ),
    timezone: text('timezone').notNull(),
    status: appointmentRequestStatusEnum('status')
      .notNull()
      .default('requested'),
    // The slot staff confirmed (set when status -> scheduled).
    scheduledStartsAt: timestamp('scheduled_starts_at', { withTimezone: true }),
    // Free-text note staff records about the consultation outcome.
    outcomeNote: text('outcome_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('appointment_requests_candidate_created_idx').on(
      table.candidateId,
      table.createdAt,
    ),
    index('appointment_requests_status_idx').on(table.status),
  ],
);

export const appointmentPreferences = pgTable(
  'appointment_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => appointmentRequests.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('appointment_preferences_request_rank_unique').on(
      table.requestId,
      table.rank,
    ),
    index('appointment_preferences_starts_at_idx').on(table.startsAt),
    check(
      'appointment_preferences_rank_check',
      sql`${table.rank} between 1 and 3`,
    ),
  ],
);

export const candidateActivities = pgTable(
  'candidate_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'restrict' }),
    inquiryId: uuid('inquiry_id').references(() => candidateInquiries.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('candidate_activities_candidate_occurred_idx').on(
      table.candidateId,
      table.occurredAt,
    ),
  ],
);

export const candidateNotes = pgTable(
  'candidate_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('candidate_notes_candidate_created_idx').on(
      table.candidateId,
      table.createdAt,
    ),
  ],
);
