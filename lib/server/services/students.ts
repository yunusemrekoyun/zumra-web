import 'server-only';

import { and, asc, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  assignments,
  assignmentSubmissions,
  contacts,
  enrollments,
  instructorProfiles,
  lessonAttendanceRecords,
  lessonSessions,
  programs,
  programBranches,
  studentAccountInvitations,
  studentProfiles,
  type ProgramSelectionSnapshot,
  userInvitations,
  users,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';
import { getDevelopmentScores } from './student-progress';

type EnrollmentStatus = 'active' | 'cancelled' | 'completed' | 'paused';
type AdminStudentStatus = 'active' | 'cancelled' | 'graduated' | 'paused';
type StudentAccountState = 'linked' | 'not_invited' | 'pending_invitation';

export type AdminStudentListItem = {
  accountState: StudentAccountState;
  branchName?: string;
  courseMode: 'group' | 'private';
  currentLevel?: string;
  email: string;
  enrolledAt: string;
  enrollmentId: string;
  fullName: string;
  instructorName?: string;
  language?: string;
  nextSessionAt?: string;
  phone?: string;
  programName?: string;
  progress: number;
  status: AdminStudentStatus;
  studentId: string;
  username?: string;
};

export type AdminStudentDetail = AdminStudentListItem & {
  invitation?: {
    expiresAt: string;
    status: string;
    username: string;
  };
};

type StudentRow = {
  branchId: string | null;
  branchName: string | null;
  branchInstructorFirstName: string | null;
  branchInstructorLastName: string | null;
  courseMode: 'group' | 'private';
  currentLevel: string | null;
  email: string;
  enrolledAt: Date;
  enrollmentId: string;
  enrollmentStatus: EnrollmentStatus;
  firstName: string;
  language: string | null;
  lastName: string;
  phone: string | null;
  programName: string | null;
  programSelection: ProgramSelectionSnapshot;
  studentId: string;
  userId: string | null;
  username: string | null;
};

export async function getAdminStudents(
  principal: WorkspacePrincipal,
): Promise<AdminStudentListItem[]> {
  assertAdmin(principal);

  const rows = await loadStudentRows();
  return hydrateStudentRows(rows);
}

export async function getAdminStudentDetail(
  principal: WorkspacePrincipal,
  studentId: string,
): Promise<AdminStudentDetail | null> {
  assertAdmin(principal);

  const rows = await loadStudentRows(studentId);
  const [student] = await hydrateStudentRows(rows);
  if (!student) return null;

  const invitation = await loadLatestInvitation(student.studentId);
  return {
    ...student,
    invitation: invitation
      ? {
          expiresAt: invitation.expiresAt.toISOString(),
          status: invitation.status,
          username: invitation.username,
        }
      : undefined,
  };
}

async function loadStudentRows(studentId?: string) {
  const query = database
    .select({
      branchId: enrollments.branchId,
      branchName: programBranches.name,
      courseMode: enrollments.courseMode,
      currentLevel: studentProfiles.currentLevel,
      email: contacts.email,
      enrolledAt: enrollments.enrolledAt,
      enrollmentId: enrollments.id,
      enrollmentStatus: enrollments.status,
      firstName: contacts.firstName,
      language: programs.language,
      lastName: contacts.lastName,
      phone: contacts.phone,
      programName: programs.name,
      programSelection: enrollments.programSelection,
      studentId: studentProfiles.id,
      userId: studentProfiles.userId,
      username: users.username,
      branchInstructorFirstName: instructorProfiles.firstName,
      branchInstructorLastName: instructorProfiles.lastName,
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .leftJoin(
      instructorProfiles,
      sql`${instructorProfiles.id} = coalesce(${enrollments.selectedInstructorProfileId}, ${programBranches.instructorProfileId})`,
    )
    .leftJoin(users, eq(users.id, studentProfiles.userId));

  const scoped = studentId
    ? query.where(eq(studentProfiles.id, studentId))
    : query;

  return scoped.orderBy(desc(enrollments.enrolledAt), asc(contacts.lastName));
}

async function hydrateStudentRows(
  rows: StudentRow[],
): Promise<AdminStudentListItem[]> {
  const studentIds = rows.map((row) => row.studentId);
  const [nextSessions, invitations, progressScores] = await Promise.all([
    loadNextSessions(rows),
    loadLatestInvitations(studentIds),
    getDevelopmentScores(studentIds),
  ]);

  return rows.map((row) => {
    const snapshot = row.programSelection ?? {};
    const invitation = invitations.get(row.studentId);
    const accountState: StudentAccountState = row.userId
      ? 'linked'
      : invitation?.status === 'pending'
        ? 'pending_invitation'
        : 'not_invited';

    return {
      accountState,
      branchName: row.branchName ?? snapshot.branchName,
      courseMode: row.courseMode,
      currentLevel: row.currentLevel ?? undefined,
      email: row.email,
      enrolledAt: row.enrolledAt.toISOString(),
      enrollmentId: row.enrollmentId,
      fullName: fullName(row.firstName, row.lastName),
      instructorName:
        snapshot.teacherName ??
        (row.branchInstructorFirstName
          ? fullName(row.branchInstructorFirstName, row.branchInstructorLastName ?? '')
          : undefined),
      language: row.language ?? snapshot.language,
      nextSessionAt: nextSessions.get(row.enrollmentId)?.toISOString(),
      phone: row.phone ?? undefined,
      programName: row.programName ?? snapshot.label,
      progress: progressScores.get(row.studentId) ?? 0,
      status: mapEnrollmentStatus(row.enrollmentStatus),
      studentId: row.studentId,
      username: row.username ?? invitation?.username,
    };
  });
}

export type AdminStudentActivity = {
  lessons: Array<{
    id: string;
    label: string | null;
    startsAt: string;
    status: string;
  }>;
  submissions: Array<{
    id: string;
    title: string;
    submittedAt: string;
    score: number | null;
    maxScore: number;
    graded: boolean;
  }>;
};

export async function getAdminStudentActivity(
  principal: WorkspacePrincipal,
  studentId: string,
): Promise<AdminStudentActivity> {
  assertAdmin(principal);

  const [lessonRows, submissionRows] = await Promise.all([
    database
      .select({
        id: lessonAttendanceRecords.id,
        status: lessonAttendanceRecords.status,
        startsAt: lessonSessions.startsAt,
        branchName: programBranches.name,
      })
      .from(lessonAttendanceRecords)
      .innerJoin(
        lessonSessions,
        eq(lessonSessions.id, lessonAttendanceRecords.lessonSessionId),
      )
      .leftJoin(programBranches, eq(programBranches.id, lessonSessions.branchId))
      .where(eq(lessonAttendanceRecords.studentProfileId, studentId))
      .orderBy(desc(lessonSessions.startsAt))
      .limit(8),
    database
      .select({
        id: assignmentSubmissions.id,
        title: assignments.title,
        submittedAt: assignmentSubmissions.submittedAt,
        score: assignmentSubmissions.score,
        maxScore: assignments.maxScore,
        status: assignmentSubmissions.status,
      })
      .from(assignmentSubmissions)
      .innerJoin(
        assignments,
        eq(assignments.id, assignmentSubmissions.assignmentId),
      )
      .where(eq(assignmentSubmissions.studentProfileId, studentId))
      .orderBy(desc(assignmentSubmissions.submittedAt))
      .limit(6),
  ]);

  return {
    lessons: lessonRows.map((row) => ({
      id: row.id,
      label: row.branchName,
      startsAt: row.startsAt.toISOString(),
      status: row.status,
    })),
    submissions: submissionRows.map((row) => ({
      id: row.id,
      title: row.title,
      submittedAt: row.submittedAt.toISOString(),
      score: row.score,
      maxScore: row.maxScore ?? 100,
      graded: row.status === 'graded' && row.score != null,
    })),
  };
}

async function loadNextSessions(rows: StudentRow[]) {
  const branchIds = Array.from(
    new Set(
      rows
        .filter((row) => row.courseMode === 'group')
        .map((row) => row.branchId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const privateEnrollmentIds = rows
    .filter((row) => row.courseMode === 'private')
    .map((row) => row.enrollmentId);
  const predicates = [];

  if (branchIds.length) {
    predicates.push(inArray(lessonSessions.branchId, branchIds));
  }
  if (privateEnrollmentIds.length) {
    predicates.push(inArray(lessonSessions.enrollmentId, privateEnrollmentIds));
  }
  if (!predicates.length) return new Map<string, Date>();

  const rowsBySession = await database
    .select({
      branchId: lessonSessions.branchId,
      enrollmentId: lessonSessions.enrollmentId,
      startsAt: lessonSessions.startsAt,
    })
    .from(lessonSessions)
    .where(
      and(
        gt(lessonSessions.startsAt, new Date()),
        predicates.length === 1 ? predicates[0] : or(...predicates),
      ),
    )
    .orderBy(asc(lessonSessions.startsAt));
  const nextByEnrollment = new Map<string, Date>();

  for (const row of rows) {
    const session = rowsBySession.find((item) =>
      row.courseMode === 'private'
        ? item.enrollmentId === row.enrollmentId
        : item.branchId === row.branchId,
    );
    if (session) {
      nextByEnrollment.set(row.enrollmentId, session.startsAt);
    }
  }

  return nextByEnrollment;
}

async function loadLatestInvitation(studentId: string) {
  const rows = await loadLatestInvitations([studentId]);
  return rows.get(studentId);
}

async function loadLatestInvitations(studentIds: string[]) {
  const ids = Array.from(new Set(studentIds));
  if (!ids.length) {
    return new Map<
      string,
      { expiresAt: Date; status: string; username: string }
    >();
  }

  const rows = await database
    .select({
      expiresAt: userInvitations.expiresAt,
      status: userInvitations.status,
      studentId: studentAccountInvitations.studentId,
      username: userInvitations.username,
    })
    .from(studentAccountInvitations)
    .innerJoin(
      userInvitations,
      eq(userInvitations.id, studentAccountInvitations.invitationId),
    )
    .where(inArray(studentAccountInvitations.studentId, ids))
    .orderBy(desc(userInvitations.createdAt));
  const byStudent = new Map<
    string,
    { expiresAt: Date; status: string; username: string }
  >();

  for (const row of rows) {
    if (!byStudent.has(row.studentId)) {
      byStudent.set(row.studentId, {
        expiresAt: row.expiresAt,
        status: row.status,
        username: row.username,
      });
    }
  }

  return byStudent;
}

function mapEnrollmentStatus(status: EnrollmentStatus): AdminStudentStatus {
  if (status === 'completed') return 'graduated';
  return status;
}

function assertAdmin(principal: WorkspacePrincipal) {
  // Staff scope: advisors run the same CRM/enrollment flows as admins.
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
