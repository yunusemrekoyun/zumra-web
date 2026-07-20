import 'server-only';

import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { isoToIstanbulWallClock, istanbulWallClockToISO } from '@/lib/datetime';
import { database } from '@/lib/server/db/client';
import {
  appointmentPreferences,
  appointmentRequests,
  candidateProfiles,
  contacts,
  enrollmentInstallments,
  enrollments,
  lessonAttendanceRecords,
  lessonSessions,
  paymentRecords,
  studentProfiles,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

export type AppointmentOverviewRow = {
  candidateId: string;
  candidateName: string;
  createdAt: string;
  id: string;
  outcomeNote: string | null;
  preferences: string[];
  scheduledStartsAt: string | null;
  status: 'cancelled' | 'completed' | 'no_show' | 'requested' | 'scheduled';
};

export type AdvisorOverview = {
  myAssignedCount: number;
  newThisWeek: number;
  pendingRequests: AppointmentOverviewRow[];
  stageCounts: Record<string, number>;
  todaysMeetings: AppointmentOverviewRow[];
  upcoming: AppointmentOverviewRow[];
};

async function appointmentRows(
  where: ReturnType<typeof and>,
  order: 'asc' | 'desc',
  limit: number,
): Promise<AppointmentOverviewRow[]> {
  const rows = await database
    .select({
      candidateId: appointmentRequests.candidateId,
      createdAt: appointmentRequests.createdAt,
      firstName: contacts.firstName,
      id: appointmentRequests.id,
      lastName: contacts.lastName,
      outcomeNote: appointmentRequests.outcomeNote,
      scheduledStartsAt: appointmentRequests.scheduledStartsAt,
      status: appointmentRequests.status,
    })
    .from(appointmentRequests)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, appointmentRequests.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .where(where)
    .orderBy(
      order === 'asc'
        ? asc(appointmentRequests.scheduledStartsAt)
        : desc(appointmentRequests.createdAt),
    )
    .limit(limit);

  const requestIds = rows.map((row) => row.id);
  const preferences = requestIds.length
    ? await database
        .select({
          requestId: appointmentPreferences.requestId,
          startsAt: appointmentPreferences.startsAt,
        })
        .from(appointmentPreferences)
        .where(inArray(appointmentPreferences.requestId, requestIds))
        .orderBy(asc(appointmentPreferences.rank))
    : [];

  return rows.map((row) => ({
    candidateId: row.candidateId,
    candidateName: `${row.firstName} ${row.lastName}`.trim(),
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    outcomeNote: row.outcomeNote,
    preferences: preferences
      .filter((preference) => preference.requestId === row.id)
      .map((preference) => preference.startsAt.toISOString()),
    scheduledStartsAt: row.scheduledStartsAt?.toISOString() ?? null,
    status: row.status,
  }));
}

/** Istanbul-local [00:00, 24:00) window that contains the given instant. */
function istanbulDayWindow(now: Date) {
  const localDate = isoToIstanbulWallClock(now.toISOString()).slice(0, 10);
  const dayStart = new Date(istanbulWallClockToISO(`${localDate}T00:00`));
  return { dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000), dayStart };
}

export async function getAdvisorOverview(
  principal: WorkspacePrincipal,
): Promise<AdvisorOverview> {
  assertStaff(principal);

  const now = new Date();
  const { dayEnd, dayStart } = istanbulDayWindow(now);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [stageRows, [assigned], [fresh], pendingRequests, upcoming, todaysMeetings] =
    await Promise.all([
      database
        .select({
          count: sql<number>`count(*)::int`,
          stage: candidateProfiles.stage,
        })
        .from(candidateProfiles)
        .groupBy(candidateProfiles.stage),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.advisorId, principal.id)),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(candidateProfiles)
        .where(gte(candidateProfiles.createdAt, weekAgo)),
      appointmentRows(
        and(eq(appointmentRequests.status, 'requested')),
        'desc',
        6,
      ),
      appointmentRows(
        and(
          eq(appointmentRequests.status, 'scheduled'),
          gte(appointmentRequests.scheduledStartsAt, now),
        ),
        'asc',
        6,
      ),
      appointmentRows(
        and(
          eq(appointmentRequests.status, 'scheduled'),
          gte(appointmentRequests.scheduledStartsAt, dayStart),
          lt(appointmentRequests.scheduledStartsAt, dayEnd),
        ),
        'asc',
        10,
      ),
    ]);

  return {
    myAssignedCount: assigned?.count ?? 0,
    newThisWeek: fresh?.count ?? 0,
    pendingRequests,
    stageCounts: Object.fromEntries(
      stageRows.map((row) => [row.stage, row.count]),
    ),
    todaysMeetings,
    upcoming,
  };
}

export type AppointmentsOverview = {
  past: AppointmentOverviewRow[];
  requested: AppointmentOverviewRow[];
  scheduled: AppointmentOverviewRow[];
};

export async function listAppointmentsOverview(
  principal: WorkspacePrincipal,
): Promise<AppointmentsOverview> {
  assertStaff(principal);

  const [requested, scheduled, past] = await Promise.all([
    appointmentRows(and(eq(appointmentRequests.status, 'requested')), 'desc', 50),
    appointmentRows(and(eq(appointmentRequests.status, 'scheduled')), 'asc', 50),
    appointmentRows(
      and(
        inArray(appointmentRequests.status, [
          'cancelled',
          'completed',
          'no_show',
        ]),
      ),
      'desc',
      30,
    ),
  ]);

  return { past, requested, scheduled };
}

// ---------------------------------------------------------------------------
// Follow-up list: which of MY students (advisor-owned candidates that became
// students) currently need attention — overdue installments, payment reports
// waiting for teacher review, or recent confirmed absences.
// ---------------------------------------------------------------------------

export type AdvisorFollowUpRow = {
  fullName: string;
  overdueInstallments: number;
  pendingPaymentReports: number;
  recentAbsences: number;
  studentProfileId: string;
};

export async function getAdvisorFollowUps(
  principal: WorkspacePrincipal,
): Promise<AdvisorFollowUpRow[]> {
  if (principal.role !== 'advisor' && principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Advisor access is required.');
  }

  const students = await database
    .select({
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      studentProfileId: studentProfiles.id,
    })
    .from(candidateProfiles)
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .innerJoin(
      studentProfiles,
      eq(studentProfiles.contactId, candidateProfiles.contactId),
    )
    .where(eq(candidateProfiles.advisorId, principal.id));

  if (!students.length) return [];

  const studentIds = students.map((row) => row.studentProfileId);
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);
  // dueDate is a plain date column (string) keyed to Istanbul days.
  const todayIso = isoToIstanbulWallClock(now.toISOString()).slice(0, 10);

  const [installmentRows, reportRows, absenceRows] = await Promise.all([
    database
      .select({
        overdue: sql<number>`count(*)::int`,
        studentId: enrollments.studentId,
      })
      .from(enrollmentInstallments)
      .innerJoin(
        enrollments,
        eq(enrollments.id, enrollmentInstallments.enrollmentId),
      )
      .where(
        and(
          inArray(enrollments.studentId, studentIds),
          inArray(enrollments.status, ['active', 'paused']),
          sql`${enrollmentInstallments.status} <> 'paid'`,
          lt(enrollmentInstallments.dueDate, todayIso),
        ),
      )
      .groupBy(enrollments.studentId),
    database
      .select({
        pending: sql<number>`count(*)::int`,
        studentId: enrollments.studentId,
      })
      .from(paymentRecords)
      .innerJoin(enrollments, eq(enrollments.id, paymentRecords.enrollmentId))
      .where(
        and(
          inArray(enrollments.studentId, studentIds),
          eq(paymentRecords.status, 'reported'),
        ),
      )
      .groupBy(enrollments.studentId),
    database
      .select({
        absences: sql<number>`count(*)::int`,
        studentId: lessonAttendanceRecords.studentProfileId,
      })
      .from(lessonAttendanceRecords)
      .innerJoin(
        lessonSessions,
        eq(lessonSessions.id, lessonAttendanceRecords.lessonSessionId),
      )
      .where(
        and(
          inArray(lessonAttendanceRecords.studentProfileId, studentIds),
          eq(lessonAttendanceRecords.status, 'absent'),
          sql`${lessonAttendanceRecords.confirmedAt} is not null`,
          gte(lessonSessions.startsAt, twoWeeksAgo),
        ),
      )
      .groupBy(lessonAttendanceRecords.studentProfileId),
  ]);

  const overdueByStudent = new Map(
    installmentRows.map((row) => [row.studentId, Number(row.overdue)]),
  );
  const reportsByStudent = new Map(
    reportRows.map((row) => [row.studentId, Number(row.pending)]),
  );
  const absencesByStudent = new Map(
    absenceRows.map((row) => [row.studentId, Number(row.absences)]),
  );

  return students
    .map((student) => ({
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      overdueInstallments:
        overdueByStudent.get(student.studentProfileId) ?? 0,
      pendingPaymentReports:
        reportsByStudent.get(student.studentProfileId) ?? 0,
      recentAbsences: absencesByStudent.get(student.studentProfileId) ?? 0,
      studentProfileId: student.studentProfileId,
    }))
    .filter(
      (row) =>
        row.overdueInstallments > 0 ||
        row.pendingPaymentReports > 0 ||
        row.recentAbsences > 0,
    )
    .sort(
      (a, b) =>
        b.overdueInstallments + b.pendingPaymentReports + b.recentAbsences -
        (a.overdueInstallments + a.pendingPaymentReports + a.recentAbsences),
    );
}
