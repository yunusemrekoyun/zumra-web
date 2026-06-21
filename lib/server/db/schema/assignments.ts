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
import { enrollments, studentProfiles } from './enrollments';
import { mediaAssets } from './foundation';
import { instructorProfiles } from './instructors';
import { programBranches } from './programs';
import { lessonSessions } from './schedule';

export const assignmentTargetTypeEnum = pgEnum('assignment_target_type', [
  'student',
  'branch',
]);

export const assignmentSubmissionStatusEnum = pgEnum(
  'assignment_submission_status',
  ['submitted', 'graded'],
);

// An assignment OR material created by an instructor. requiresSubmission=false
// means it is a shared material (no submission expected); true means homework.
// Target is either a single enrollment (one student) or a whole branch (group);
// the expected-student roster is derived from enrollments (attendance pattern).
export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorProfileId: uuid('instructor_profile_id')
      .notNull()
      .references(() => instructorProfiles.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description'),
    requiresSubmission: boolean('requires_submission').notNull().default(true),
    maxScore: integer('max_score'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    targetType: assignmentTargetTypeEnum('target_type').notNull(),
    targetBranchId: uuid('target_branch_id').references(
      () => programBranches.id,
      { onDelete: 'cascade' },
    ),
    targetEnrollmentId: uuid('target_enrollment_id').references(
      () => enrollments.id,
      { onDelete: 'cascade' },
    ),
    lessonSessionId: uuid('lesson_session_id').references(
      () => lessonSessions.id,
      { onDelete: 'set null' },
    ),
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
    index('assignments_instructor_idx').on(table.instructorProfileId),
    index('assignments_branch_idx').on(table.targetBranchId),
    index('assignments_enrollment_idx').on(table.targetEnrollmentId),
    index('assignments_lesson_session_idx').on(table.lessonSessionId),
    check(
      'assignments_target_check',
      sql`(${table.targetType} = 'branch' and ${table.targetBranchId} is not null and ${table.targetEnrollmentId} is null)
        or (${table.targetType} = 'student' and ${table.targetEnrollmentId} is not null and ${table.targetBranchId} is null)`,
    ),
    check(
      'assignments_max_score_check',
      sql`${table.maxScore} is null or ${table.maxScore} > 0`,
    ),
  ],
);

// One submission per (assignment, student). Rows are created lazily when the
// student submits; "not submitted" is derived from the roster (no row). After
// the teacher grades, the row locks (status='graded') and the student can no
// longer edit.
export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    body: text('body'),
    status: assignmentSubmissionStatusEnum('status')
      .notNull()
      .default('submitted'),
    isLate: boolean('is_late').notNull().default(false),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    score: integer('score'),
    feedback: text('feedback'),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    gradedByUserId: text('graded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assignment_submissions_assignment_student_unique').on(
      table.assignmentId,
      table.studentProfileId,
    ),
    index('assignment_submissions_student_idx').on(table.studentProfileId),
    index('assignment_submissions_status_idx').on(table.status),
    check(
      'assignment_submissions_score_check',
      sql`${table.score} is null or ${table.score} >= 0`,
    ),
  ],
);

export const assignmentAttachments = pgTable(
  'assignment_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assignment_attachments_unique').on(
      table.assignmentId,
      table.mediaAssetId,
    ),
    index('assignment_attachments_assignment_idx').on(table.assignmentId),
  ],
);

export const assignmentSubmissionAttachments = pgTable(
  'assignment_submission_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => assignmentSubmissions.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('assignment_submission_attachments_unique').on(
      table.submissionId,
      table.mediaAssetId,
    ),
    index('assignment_submission_attachments_submission_idx').on(
      table.submissionId,
    ),
  ],
);
