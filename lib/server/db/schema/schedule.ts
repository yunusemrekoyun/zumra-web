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
import { enrollments, studentProfiles } from './enrollments';
import { instructorProfiles } from './instructors';
import { programBranches } from './programs';

export const lessonScheduleModeEnum = pgEnum('lesson_schedule_mode', [
  'weekly',
  'manual',
]);

export const lessonSessionSourceEnum = pgEnum('lesson_session_source', [
  'branch',
  'private',
]);

export const lessonSessionStatusEnum = pgEnum('lesson_session_status', [
  'scheduled',
  'cancelled',
  'postponed',
  'completed',
]);

export const lessonMeetingProviderEnum = pgEnum('lesson_meeting_provider', [
  'google_meet',
]);

export const lessonMeetingStatusEnum = pgEnum('lesson_meeting_status', [
  'pending',
  'creating',
  'ready',
  'failed',
  'disabled',
  'dead',
]);

export const lessonAttendanceStatusEnum = pgEnum('lesson_attendance_status', [
  'pending',
  'present',
  'late',
  'absent',
  'excused',
  'needs_review',
]);

export const lessonAttendanceSourceEnum = pgEnum('lesson_attendance_source', [
  'google_meet',
  'student_report',
  'system',
  'teacher',
]);

export const lessonAbsenceReportStatusEnum = pgEnum(
  'lesson_absence_report_status',
  ['submitted', 'acknowledged', 'dismissed'],
);

export const branchLessonScheduleRules = pgTable(
  'branch_lesson_schedule_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => programBranches.id, { onDelete: 'restrict' }),
    mode: lessonScheduleModeEnum('mode').notNull(),
    weekday: integer('weekday'),
    startTime: text('start_time'),
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
    uniqueIndex('branch_lesson_schedule_rules_branch_unique').on(
      table.branchId,
    ),
    index('branch_lesson_schedule_rules_mode_idx').on(table.mode),
    check(
      'branch_lesson_schedule_rules_weekday_check',
      sql`${table.weekday} is null or ${table.weekday} between 1 and 7`,
    ),
    check(
      'branch_lesson_schedule_rules_weekly_check',
      sql`${table.mode} <> 'weekly'
        or (
          ${table.weekday} is not null
          and ${table.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        )`,
    ),
  ],
);

export const lessonSessions = pgTable(
  'lesson_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: lessonSessionSourceEnum('source').notNull(),
    branchScheduleRuleId: uuid('branch_schedule_rule_id').references(
      () => branchLessonScheduleRules.id,
      { onDelete: 'cascade' },
    ),
    branchId: uuid('branch_id').references(() => programBranches.id, {
      onDelete: 'restrict',
    }),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'restrict',
    }),
    instructorProfileId: uuid('instructor_profile_id').references(
      () => instructorProfiles.id,
      { onDelete: 'set null' },
    ),
    studentProfileId: uuid('student_profile_id').references(
      () => studentProfiles.id,
      { onDelete: 'set null' },
    ),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timezone: text('timezone').notNull().default('Europe/Istanbul'),
    status: lessonSessionStatusEnum('status').notNull().default('scheduled'),
    originalStartsAt: timestamp('original_starts_at', { withTimezone: true }),
    changeNote: text('change_note'),
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
    // Only OPEN lessons hold a slot — a cancelled/completed lesson must not
    // block re-booking the same branch/enrollment at that time.
    uniqueIndex('lesson_sessions_branch_starts_unique')
      .on(table.branchId, table.startsAt)
      .where(
        sql`${table.branchId} is not null and ${table.status} in ('scheduled', 'postponed')`,
      ),
    uniqueIndex('lesson_sessions_enrollment_starts_unique')
      .on(table.enrollmentId, table.startsAt)
      .where(
        sql`${table.enrollmentId} is not null and ${table.status} in ('scheduled', 'postponed')`,
      ),
    index('lesson_sessions_instructor_starts_idx').on(
      table.instructorProfileId,
      table.startsAt,
    ),
    index('lesson_sessions_student_starts_idx').on(
      table.studentProfileId,
      table.startsAt,
    ),
    index('lesson_sessions_branch_idx').on(table.branchId),
    index('lesson_sessions_status_starts_idx').on(
      table.status,
      table.startsAt,
    ),
    check(
      'lesson_sessions_target_check',
      sql`(${table.source} = 'branch' and ${table.branchId} is not null)
        or (${table.source} = 'private' and ${table.enrollmentId} is not null)`,
    ),
    check(
      'lesson_sessions_period_check',
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      'lesson_sessions_timezone_check',
      sql`length(trim(${table.timezone})) > 0`,
    ),
  ],
);

export const lessonSessionMeetings = pgTable(
  'lesson_session_meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonSessionId: uuid('lesson_session_id')
      .notNull()
      .references(() => lessonSessions.id, { onDelete: 'cascade' }),
    provider: lessonMeetingProviderEnum('provider')
      .notNull()
      .default('google_meet'),
    status: lessonMeetingStatusEnum('status').notNull().default('pending'),
    spaceName: text('space_name'),
    meetingUri: text('meeting_uri'),
    meetingCode: text('meeting_code'),
    organizerEmail: text('organizer_email'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    nextSyncAt: timestamp('next_sync_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('lesson_session_meetings_session_unique').on(
      table.lessonSessionId,
    ),
    index('lesson_session_meetings_status_idx').on(table.status),
    index('lesson_session_meetings_next_sync_idx').on(table.nextSyncAt),
    index('lesson_session_meetings_next_retry_idx').on(table.nextRetryAt),
    check(
      'lesson_session_meetings_ready_check',
      sql`${table.status} <> 'ready'
        or (
          ${table.spaceName} is not null
          and ${table.meetingUri} is not null
          and ${table.meetingCode} is not null
        )`,
    ),
  ],
);

export const lessonAttendanceRecords = pgTable(
  'lesson_attendance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonSessionId: uuid('lesson_session_id')
      .notNull()
      .references(() => lessonSessions.id, { onDelete: 'cascade' }),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    status: lessonAttendanceStatusEnum('status')
      .notNull()
      .default('needs_review'),
    suggestedStatus: lessonAttendanceStatusEnum('suggested_status'),
    source: lessonAttendanceSourceEnum('source').notNull().default('system'),
    totalSeconds: integer('total_seconds').notNull().default(0),
    firstJoinedAt: timestamp('first_joined_at', { withTimezone: true }),
    lastLeftAt: timestamp('last_left_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedByUserId: text('confirmed_by_user_id').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    teacherNote: text('teacher_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('lesson_attendance_records_session_student_unique').on(
      table.lessonSessionId,
      table.studentProfileId,
    ),
    index('lesson_attendance_records_status_idx').on(table.status),
    index('lesson_attendance_records_student_idx').on(table.studentProfileId),
    check(
      'lesson_attendance_records_duration_check',
      sql`${table.totalSeconds} >= 0`,
    ),
  ],
);

export const lessonAttendanceParticipantSessions = pgTable(
  'lesson_attendance_participant_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonSessionId: uuid('lesson_session_id')
      .notNull()
      .references(() => lessonSessions.id, { onDelete: 'cascade' }),
    attendanceRecordId: uuid('attendance_record_id').references(
      () => lessonAttendanceRecords.id,
      { onDelete: 'set null' },
    ),
    matchedStudentProfileId: uuid('matched_student_profile_id').references(
      () => studentProfiles.id,
      { onDelete: 'set null' },
    ),
    googleConferenceRecordName: text('google_conference_record_name').notNull(),
    googleParticipantName: text('google_participant_name').notNull(),
    googleParticipantSessionName: text(
      'google_participant_session_name',
    ).notNull(),
    googleUser: text('google_user'),
    displayName: text('display_name').notNull(),
    anonymous: boolean('anonymous').notNull().default(false),
    matchConfidence: text('match_confidence').notNull().default('unmatched'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('lesson_attendance_participant_session_unique').on(
      table.googleParticipantSessionName,
    ),
    index('lesson_attendance_participant_session_lesson_idx').on(
      table.lessonSessionId,
    ),
    index('lesson_attendance_participant_session_google_user_idx').on(
      table.googleUser,
    ),
    check(
      'lesson_attendance_participant_session_duration_check',
      sql`${table.durationSeconds} >= 0`,
    ),
  ],
);

export const lessonAbsenceReports = pgTable(
  'lesson_absence_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonSessionId: uuid('lesson_session_id')
      .notNull()
      .references(() => lessonSessions.id, { onDelete: 'cascade' }),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => studentProfiles.id, { onDelete: 'cascade' }),
    status: lessonAbsenceReportStatusEnum('status')
      .notNull()
      .default('submitted'),
    reason: text('reason'),
    note: text('note'),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('lesson_absence_reports_session_student_unique').on(
      table.lessonSessionId,
      table.studentProfileId,
    ),
    index('lesson_absence_reports_status_idx').on(table.status),
    index('lesson_absence_reports_student_idx').on(table.studentProfileId),
  ],
);
