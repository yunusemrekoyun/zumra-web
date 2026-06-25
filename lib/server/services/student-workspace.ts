import 'server-only';

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  contacts,
  enrollments,
  programBranches,
  programs,
  studentProfiles,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';
import {
  type CalendarEventView,
  getStudentCalendarData,
} from './lesson-schedules';

export type { CalendarEventView } from './lesson-schedules';

const activeEnrollmentStatuses = ['active', 'paused'] as const;

export type StudentEnrollmentView = {
  branchName?: string;
  courseMode: 'group' | 'private';
  currentLevel?: string;
  enrolledAt: string;
  enrollmentId: string;
  language?: string;
  programName?: string;
  status: 'active' | 'paused';
};

export type StudentWorkspaceData = {
  calendar: CalendarEventView[];
  enrollment?: StudentEnrollmentView;
  enrollments: StudentEnrollmentView[];
  lessons: {
    completedCount: number;
    next?: CalendarEventView;
    past: CalendarEventView[];
    totalCount: number;
    upcoming: CalendarEventView[];
    upcomingCount: number;
  };
  student?: {
    currentLevel?: string;
    email: string;
    fullName: string;
    id: string;
    phone?: string;
    status: string;
  };
};

const emptyLessons = (): StudentWorkspaceData['lessons'] => ({
  completedCount: 0,
  next: undefined,
  past: [],
  totalCount: 0,
  upcoming: [],
  upcomingCount: 0,
});

export async function getStudentWorkspaceData(
  principal: WorkspacePrincipal,
): Promise<StudentWorkspaceData> {
  assertStudent(principal);

  const [profile] = await database
    .select({
      currentLevel: studentProfiles.currentLevel,
      email: contacts.email,
      firstName: contacts.firstName,
      id: studentProfiles.id,
      lastName: contacts.lastName,
      phone: contacts.phone,
      status: studentProfiles.status,
    })
    .from(studentProfiles)
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);

  if (!profile) {
    return { calendar: [], enrollments: [], lessons: emptyLessons() };
  }

  const enrollmentRows = await database
    .select({
      branchName: programBranches.name,
      courseMode: enrollments.courseMode,
      enrolledAt: enrollments.enrolledAt,
      enrollmentId: enrollments.id,
      language: programs.language,
      programName: programs.name,
      status: enrollments.status,
    })
    .from(enrollments)
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .where(
      and(
        eq(enrollments.studentId, profile.id),
        inArray(enrollments.status, activeEnrollmentStatuses),
      ),
    )
    .orderBy(desc(enrollments.enrolledAt));

  const enrollmentsView: StudentEnrollmentView[] = enrollmentRows.map((row) => ({
    branchName: row.branchName ?? undefined,
    courseMode: row.courseMode,
    currentLevel: profile.currentLevel ?? undefined,
    enrolledAt: row.enrolledAt.toISOString(),
    enrollmentId: row.enrollmentId,
    language: row.language ?? undefined,
    programName: row.programName ?? undefined,
    status: row.status as 'active' | 'paused',
  }));

  const { events } = await getStudentCalendarData(principal, {
    email: profile.email,
    firstName: profile.firstName,
    id: profile.id,
    lastName: profile.lastName,
  });
  const now = Date.now();
  const isUpcoming = (event: CalendarEventView) =>
    (event.status === 'scheduled' || event.status === 'postponed') &&
    new Date(event.startsAt).getTime() >= now;

  const upcoming = events
    .filter(isUpcoming)
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  const past = events
    .filter((event) => !isUpcoming(event))
    .sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );
  const completedCount = events.filter(
    (event) => event.status === 'completed',
  ).length;

  return {
    calendar: events,
    enrollment: enrollmentsView[0],
    enrollments: enrollmentsView,
    lessons: {
      completedCount,
      next: upcoming[0],
      past,
      totalCount: events.length,
      upcoming,
      upcomingCount: upcoming.length,
    },
    student: {
      currentLevel: profile.currentLevel ?? undefined,
      email: profile.email,
      fullName: fullName(profile.firstName, profile.lastName),
      id: profile.id,
      phone: profile.phone ?? undefined,
      status: profile.status,
    },
  };
}

function assertStudent(principal: WorkspacePrincipal) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
