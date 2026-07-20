import 'server-only';

import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  lt,
  sql,
  sum,
} from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { istanbulWallClockToISO, isoToIstanbulWallClock } from '@/lib/datetime';
import { database } from '@/lib/server/db/client';
import {
  advisorTasks,
  candidateProfiles,
  contacts,
  enrollmentInstallments,
  enrollments,
  instructorProfiles,
  lessonChangeRequests,
  lessonSessions,
  paymentRecords,
  programBranches,
  programs,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';

const activeEnrollmentStatuses = ['active', 'paused'] as const;

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

// Istanbul-local day window as UTC instants.
function istanbulDayWindow(offsetDays = 0) {
  const localDate = isoToIstanbulWallClock(new Date().toISOString()).slice(
    0,
    10,
  );
  const start = new Date(istanbulWallClockToISO(`${localDate}T00:00`));
  const shifted = new Date(start.getTime() + offsetDays * 86_400_000);
  return {
    end: new Date(shifted.getTime() + 86_400_000),
    start: shifted,
  };
}

// Istanbul-local month start for the month `offset` months before the current.
function istanbulMonthStart(offset = 0) {
  const localDate = isoToIstanbulWallClock(new Date().toISOString()).slice(
    0,
    10,
  );
  const [year, month] = localDate.split('-').map(Number);
  const total = year * 12 + (month - 1) - offset;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return new Date(
    istanbulWallClockToISO(
      `${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00`,
    ),
  );
}

export type AdminDashboardData = {
  alerts: {
    overdueInstallments: number;
    pendingChangeRequests: number;
    pendingPaymentReports: number;
    tasksDue: number;
  };
  kpis: {
    activeStudents: number;
    conversionPercent: number;
    newCandidates30d: number;
    totalStudents: number;
  };
  recentCandidates: Array<{
    fullName: string;
    id: string;
    lastActivityAt: string;
    stage: string;
  }>;
  todayLessons: Array<{
    id: string;
    instructorName: string | null;
    startsAt: string;
    status: string;
    title: string;
  }>;
};

export async function getAdminDashboard(
  principal: WorkspacePrincipal,
): Promise<AdminDashboardData> {
  assertAdmin(principal);

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const today = istanbulDayWindow();
  // due_date is a plain date column keyed to Istanbul days.
  const todayIso = isoToIstanbulWallClock(now.toISOString()).slice(0, 10);

  const [
    [studentTotals],
    [candidateTotals],
    [alertCounts],
    recentCandidates,
    todayLessons,
  ] = await Promise.all([
    database
      .select({
        active: countDistinct(
          sql`case when ${enrollments.status} = 'active' then ${enrollments.studentId} end`,
        ),
        total: countDistinct(studentProfiles.id),
      })
      .from(studentProfiles)
      .leftJoin(enrollments, eq(enrollments.studentId, studentProfiles.id)),
    database
      .select({
        enrolled: count(
          sql`case when ${candidateProfiles.stage} = 'enrolled' then 1 end`,
        ),
        newRecent: count(
          sql`case when ${candidateProfiles.createdAt} >= ${monthAgo} then 1 end`,
        ),
        total: count(),
      })
      .from(candidateProfiles),
    database
      .select({
        changeRequests: sql<number>`(select count(*)::int from ${lessonChangeRequests} where ${lessonChangeRequests.status} = 'pending')`,
        overdueInstallments: sql<number>`(
          select count(*)::int from ${enrollmentInstallments} i
          join ${enrollments} e on e.id = i.enrollment_id
          where i.status <> 'paid' and i.due_date < ${todayIso}
            and e.status in ('active', 'paused')
        )`,
        paymentReports: sql<number>`(select count(*)::int from ${paymentRecords} where ${paymentRecords.status} = 'reported')`,
        tasksDue: sql<number>`(
          select count(*)::int from ${advisorTasks}
          where ${advisorTasks.status} = 'open' and ${advisorTasks.dueAt} < ${now}
        )`,
      })
      .from(sql`(select 1) as one`),
    database
      .select({
        firstName: contacts.firstName,
        id: candidateProfiles.id,
        lastActivityAt: candidateProfiles.lastActivityAt,
        lastName: contacts.lastName,
        stage: candidateProfiles.stage,
      })
      .from(candidateProfiles)
      .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
      .orderBy(desc(candidateProfiles.lastActivityAt))
      .limit(5),
    database
      .select({
        branchName: programBranches.name,
        id: lessonSessions.id,
        instructorFirstName: instructorProfiles.firstName,
        instructorLastName: instructorProfiles.lastName,
        source: lessonSessions.source,
        startsAt: lessonSessions.startsAt,
        status: lessonSessions.status,
        studentFirstName: contacts.firstName,
        studentLastName: contacts.lastName,
      })
      .from(lessonSessions)
      .leftJoin(
        programBranches,
        eq(programBranches.id, lessonSessions.branchId),
      )
      .leftJoin(
        instructorProfiles,
        eq(instructorProfiles.id, lessonSessions.instructorProfileId),
      )
      .leftJoin(
        studentProfiles,
        eq(studentProfiles.id, lessonSessions.studentProfileId),
      )
      .leftJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(
        and(
          gte(lessonSessions.startsAt, today.start),
          lt(lessonSessions.startsAt, today.end),
          inArray(lessonSessions.status, ['scheduled', 'postponed']),
        ),
      )
      .orderBy(asc(lessonSessions.startsAt))
      .limit(8),
  ]);

  const candidateTotal = Number(candidateTotals?.total ?? 0);
  const enrolled = Number(candidateTotals?.enrolled ?? 0);

  return {
    alerts: {
      overdueInstallments: Number(alertCounts?.overdueInstallments ?? 0),
      pendingChangeRequests: Number(alertCounts?.changeRequests ?? 0),
      pendingPaymentReports: Number(alertCounts?.paymentReports ?? 0),
      tasksDue: Number(alertCounts?.tasksDue ?? 0),
    },
    kpis: {
      activeStudents: Number(studentTotals?.active ?? 0),
      conversionPercent: candidateTotal
        ? Math.round((enrolled / candidateTotal) * 100)
        : 0,
      newCandidates30d: Number(candidateTotals?.newRecent ?? 0),
      totalStudents: Number(studentTotals?.total ?? 0),
    },
    recentCandidates: recentCandidates.map((row) => ({
      fullName: fullName(row.firstName, row.lastName),
      id: row.id,
      lastActivityAt: row.lastActivityAt.toISOString(),
      stage: row.stage,
    })),
    todayLessons: todayLessons.map((row) => ({
      id: row.id,
      instructorName:
        row.instructorFirstName && row.instructorLastName
          ? fullName(row.instructorFirstName, row.instructorLastName)
          : null,
      startsAt: row.startsAt.toISOString(),
      status: row.status,
      title:
        row.source === 'branch'
          ? (row.branchName ?? '—')
          : row.studentFirstName
            ? fullName(row.studentFirstName, row.studentLastName ?? '')
            : '—',
    })),
  };
}

export type AdminReportsData = {
  advisors: Array<{
    assigned: number;
    enrolled: number;
    fullName: string;
  }>;
  kpis: {
    activePercent: number;
    collectedThisMonthCents: number;
    conversionPercent: number;
    growthPercent: number | null;
    newEnrollmentsPrevMonth: number;
    newEnrollmentsThisMonth: number;
  };
  languageStats: Array<{
    count: number;
    language: string;
    percentage: number;
  }>;
};

export async function getAdminReports(
  principal: WorkspacePrincipal,
): Promise<AdminReportsData> {
  assertAdmin(principal);

  const thisMonthStart = istanbulMonthStart(0);
  const prevMonthStart = istanbulMonthStart(1);

  const [
    [enrollmentCounts],
    [candidateTotals],
    [collected],
    languageRows,
    advisorRows,
  ] = await Promise.all([
    database
      .select({
        active: count(
          sql`case when ${enrollments.status} = 'active' then 1 end`,
        ),
        prevMonth: count(
          sql`case when ${enrollments.enrolledAt} >= ${prevMonthStart} and ${enrollments.enrolledAt} < ${thisMonthStart} then 1 end`,
        ),
        thisMonth: count(
          sql`case when ${enrollments.enrolledAt} >= ${thisMonthStart} then 1 end`,
        ),
        total: count(),
      })
      .from(enrollments),
    database
      .select({
        enrolled: count(
          sql`case when ${candidateProfiles.stage} = 'enrolled' then 1 end`,
        ),
        total: count(),
      })
      .from(candidateProfiles),
    database
      .select({ total: sum(paymentRecords.amountCents) })
      .from(paymentRecords)
      .where(
        and(
          eq(paymentRecords.status, 'confirmed'),
          gte(paymentRecords.reviewedAt, thisMonthStart),
        ),
      ),
    database
      .select({
        count: count(),
        language: sql<string>`coalesce(${programs.language}, ${enrollments.programSelection}->>'language', 'other')`,
      })
      .from(enrollments)
      .leftJoin(programs, eq(programs.id, enrollments.programId))
      .where(inArray(enrollments.status, [...activeEnrollmentStatuses]))
      .groupBy(
        sql`coalesce(${programs.language}, ${enrollments.programSelection}->>'language', 'other')`,
      )
      .orderBy(desc(count())),
    database
      .select({
        assigned: count(candidateProfiles.id),
        enrolled: count(
          sql`case when ${candidateProfiles.stage} = 'enrolled' then 1 end`,
        ),
        name: users.name,
      })
      .from(users)
      .innerJoin(candidateProfiles, eq(candidateProfiles.advisorId, users.id))
      .where(eq(users.role, 'advisor'))
      .groupBy(users.id, users.name)
      .orderBy(desc(count(candidateProfiles.id))),
  ]);

  const thisMonth = Number(enrollmentCounts?.thisMonth ?? 0);
  const prevMonth = Number(enrollmentCounts?.prevMonth ?? 0);
  const totalEnrollments = Number(enrollmentCounts?.total ?? 0);
  const candidateTotal = Number(candidateTotals?.total ?? 0);
  const languageTotal = languageRows.reduce(
    (acc, row) => acc + Number(row.count),
    0,
  );

  return {
    advisors: advisorRows.map((row) => ({
      assigned: Number(row.assigned),
      enrolled: Number(row.enrolled),
      fullName: row.name,
    })),
    kpis: {
      activePercent: totalEnrollments
        ? Math.round(
            (Number(enrollmentCounts?.active ?? 0) / totalEnrollments) * 100,
          )
        : 0,
      collectedThisMonthCents: Number(collected?.total ?? 0),
      conversionPercent: candidateTotal
        ? Math.round(
            (Number(candidateTotals?.enrolled ?? 0) / candidateTotal) * 100,
          )
        : 0,
      growthPercent: prevMonth
        ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100)
        : null,
      newEnrollmentsPrevMonth: prevMonth,
      newEnrollmentsThisMonth: thisMonth,
    },
    languageStats: languageRows.map((row) => ({
      count: Number(row.count),
      language: row.language,
      percentage: languageTotal
        ? Math.round((Number(row.count) / languageTotal) * 100)
        : 0,
    })),
  };
}
