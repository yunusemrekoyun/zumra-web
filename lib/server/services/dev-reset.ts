import 'server-only';

import type { PoolClient } from 'pg';
import type { WorkspacePrincipal } from '@/lib/domain';
import { databasePool } from '@/lib/server/db/client';

type DeleteStatement = {
  key: string;
  sql: string;
};

export type DevelopmentResetResult = {
  deletedCounts: Record<string, number>;
  preservedAdminUserId: string;
  preservedSessionId: string;
  resetAt: string;
};

const DELETE_ALL_STATEMENTS: DeleteStatement[] = [
  {
    key: 'lessonAttendanceParticipantSessions',
    sql: 'delete from lesson_attendance_participant_sessions',
  },
  {
    key: 'lessonAttendanceRecords',
    sql: 'delete from lesson_attendance_records',
  },
  {
    key: 'lessonAbsenceReports',
    sql: 'delete from lesson_absence_reports',
  },
  {
    key: 'lessonSessionMeetings',
    sql: 'delete from lesson_session_meetings',
  },
  { key: 'lessonSessions', sql: 'delete from lesson_sessions' },
  {
    key: 'branchLessonScheduleRules',
    sql: 'delete from branch_lesson_schedule_rules',
  },
  {
    key: 'enrollmentBranchTransfers',
    sql: 'delete from enrollment_branch_transfers',
  },
  { key: 'enrollmentDocuments', sql: 'delete from enrollment_documents' },
  { key: 'enrollments', sql: 'delete from enrollments' },
  {
    key: 'studentAccountInvitations',
    sql: 'delete from student_account_invitations',
  },
  { key: 'studentProfiles', sql: 'delete from student_profiles' },
  { key: 'enrollmentParties', sql: 'delete from enrollment_parties' },
  { key: 'enrollmentDrafts', sql: 'delete from enrollment_drafts' },
  { key: 'appointmentPreferences', sql: 'delete from appointment_preferences' },
  { key: 'appointmentRequests', sql: 'delete from appointment_requests' },
  { key: 'assessmentResults', sql: 'delete from assessment_results' },
  { key: 'assessmentAnswers', sql: 'delete from assessment_answers' },
  { key: 'assessmentAttempts', sql: 'delete from assessment_attempts' },
  { key: 'candidateActivities', sql: 'delete from candidate_activities' },
  { key: 'candidateConsents', sql: 'delete from candidate_consents' },
  { key: 'candidateInquiries', sql: 'delete from candidate_inquiries' },
  { key: 'candidateProfiles', sql: 'delete from candidate_profiles' },
  { key: 'contacts', sql: 'delete from contacts' },
  {
    key: 'instructorAccountInvitations',
    sql: 'delete from instructor_account_invitations',
  },
  { key: 'instructorDocuments', sql: 'delete from instructor_documents' },
  {
    key: 'privateLessonStudentRates',
    sql: 'delete from private_lesson_student_rates',
  },
  { key: 'programBranches', sql: 'delete from program_branches' },
  {
    key: 'instructorLanguageCompetencies',
    sql: 'delete from instructor_language_competencies',
  },
  { key: 'instructorProfiles', sql: 'delete from instructor_profiles' },
  {
    key: 'programs',
    sql: 'delete from programs where coalesce(system_managed, false) = false',
  },
  { key: 'mediaAssets', sql: 'delete from media_assets' },
  { key: 'notificationOutbox', sql: 'delete from notification_outbox' },
  { key: 'backupRuns', sql: 'delete from backup_runs' },
  { key: 'workerHeartbeats', sql: 'delete from worker_heartbeats' },
  { key: 'userInvitations', sql: 'delete from user_invitations' },
  { key: 'verifications', sql: 'delete from verifications' },
  { key: 'securityChallenges', sql: 'delete from security_challenges' },
  { key: 'securityEvents', sql: 'delete from security_events' },
  { key: 'auditLogs', sql: 'delete from audit_logs' },
];

const PRESERVE_ADMIN_STATEMENTS: DeleteStatement[] = [
  {
    key: 'trustedDevices',
    sql: 'delete from trusted_devices where user_id <> $1',
  },
  {
    key: 'externalIdentities',
    sql: 'delete from external_identities where user_id <> $1',
  },
  {
    key: 'sessions',
    sql: 'delete from sessions where id <> $2',
  },
  {
    key: 'accounts',
    sql: 'delete from accounts where user_id <> $1',
  },
  {
    key: 'twoFactors',
    sql: 'delete from two_factors where user_id <> $1',
  },
  {
    key: 'users',
    sql: 'delete from users where id <> $1',
  },
];

export async function resetDevelopmentWorkspaceData(
  principal: WorkspacePrincipal,
): Promise<DevelopmentResetResult> {
  const client = await databasePool.connect();
  const deletedCounts: Record<string, number> = {};

  try {
    await client.query('begin');

    for (const statement of DELETE_ALL_STATEMENTS) {
      deletedCounts[statement.key] = await executeDelete(client, statement.sql);
    }

    for (const statement of PRESERVE_ADMIN_STATEMENTS) {
      deletedCounts[statement.key] = await executeDelete(client, statement.sql, [
        principal.id,
        principal.sessionId,
      ]);
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return {
    deletedCounts,
    preservedAdminUserId: principal.id,
    preservedSessionId: principal.sessionId,
    resetAt: new Date().toISOString(),
  };
}

async function executeDelete(
  client: PoolClient,
  sql: string,
  values: unknown[] = [],
) {
  const result = await client.query(sql, values);
  return result.rowCount ?? 0;
}
