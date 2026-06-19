import 'server-only';

import {
  and,
  asc,
  count as drizzleCount,
  eq,
  inArray,
  isNotNull,
} from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  accounts,
  branchLessonScheduleRules,
  contacts,
  enrollments,
  externalIdentities,
  lessonAbsenceReports,
  lessonSessionMeetings,
  lessonSessions,
  programBranches,
  programs,
  instructorProfiles,
  studentProfiles,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { ensureLessonMeetingsForSessions } from './lesson-meetings';

export const LESSON_DURATION_MINUTES = 60;

export type BranchLessonInput = {
  date: string;
  startTime: string;
};

export type BranchLessonScheduleInput = {
  lessons?: BranchLessonInput[];
  repeatWeekly: boolean;
  startTime?: string;
  weekday?: number;
};

export type BranchLessonSessionView = {
  date: string;
  endsAt: string;
  id: string;
  meetingAttempts?: number;
  meetingLastError?: string;
  meetingStatus?: 'creating' | 'disabled' | 'failed' | 'pending' | 'ready';
  startsAt: string;
  startTime: string;
  status: 'scheduled' | 'cancelled' | 'postponed' | 'completed';
};

export type BranchLessonScheduleView = {
  repeatWeekly: boolean;
  sessionCount: number;
  sessions: BranchLessonSessionView[];
  startTime?: string;
  weekday?: number;
};

export type CalendarEventKind =
  | 'appointment'
  | 'group_lesson'
  | 'private_lesson';

export type CalendarEventStatus =
  | 'cancelled'
  | 'completed'
  | 'postponed'
  | 'scheduled';

export type CalendarEventView = {
  absenceReported?: boolean;
  absenceReportUrl?: string;
  branchName?: string;
  date: string;
  endsAt: string;
  id: string;
  instructorName?: string;
  joinUrl?: string;
  kind: CalendarEventKind;
  meta: string[];
  meetingAttempts?: number;
  meetingLastError?: string;
  meetingProvider?: 'google_meet';
  meetingRetryUrl?: string;
  meetingStatus?: 'creating' | 'disabled' | 'failed' | 'pending' | 'ready';
  programName?: string;
  requiresGoogleLink?: boolean;
  source: 'branch' | 'private';
  startsAt: string;
  startTime: string;
  status: CalendarEventStatus;
  studentCount?: number;
  studentName?: string;
  subtitle?: string;
  title: string;
};

export type TeacherCalendarSessionView = CalendarEventView;

export type AdminCalendarData = {
  events: CalendarEventView[];
};

export type StudentCalendarData = {
  events: CalendarEventView[];
  student?: {
    email: string;
    fullName: string;
    id: string;
  };
};

export type TeacherCalendarData = {
  events: CalendarEventView[];
  instructor?: {
    email: string;
    fullName: string;
    id: string;
  };
  sessions: TeacherCalendarSessionView[];
};

type LessonCalendarRow = {
  branchId: string | null;
  branchName: string | null;
  endsAt: Date;
  id: string;
  instructorFirstName: string | null;
  instructorLastName: string | null;
  meetingAttempts: number | null;
  meetingLastError: string | null;
  meetingStatus: 'creating' | 'disabled' | 'failed' | 'pending' | 'ready' | null;
  programName: string | null;
  source: 'branch' | 'private';
  startsAt: Date;
  status: CalendarEventStatus;
  studentFirstName: string | null;
  studentLastName: string | null;
  timezone: string;
};

export async function replaceBranchLessonSchedule(
  principal: WorkspacePrincipal,
  branchId: string,
  input: BranchLessonScheduleInput,
) {
  assertAdmin(principal);

  const result = await database.transaction(async (transaction) => {
    const [branch] = await transaction
      .select({
        archivedAt: programBranches.archivedAt,
        id: programBranches.id,
        instructorProfileId: programBranches.instructorProfileId,
        name: programBranches.name,
        plannedEndDate: programBranches.plannedEndDate,
        plannedStartDate: programBranches.plannedStartDate,
        programName: programs.name,
        timezone: programBranches.timezone,
      })
      .from(programBranches)
      .innerJoin(programs, eq(programs.id, programBranches.programId))
      .where(eq(programBranches.id, branchId))
      .limit(1)
      .for('update');

    if (!branch || branch.archivedAt) {
      throw new PublicFlowError('program_branch_not_found', 404);
    }

    if (!branch.instructorProfileId) {
      throw new PublicFlowError('branch_schedule_instructor_required', 409);
    }

    const lessonInputs = normalizeLessonInputs(branch, input);
    const now = new Date();

    await transaction
      .delete(lessonSessions)
      .where(
        and(
          eq(lessonSessions.source, 'branch'),
          eq(lessonSessions.branchId, branch.id),
        ),
      );
    await transaction
      .delete(branchLessonScheduleRules)
      .where(eq(branchLessonScheduleRules.branchId, branch.id));

    const [rule] = await transaction
      .insert(branchLessonScheduleRules)
      .values({
        branchId: branch.id,
        createdByUserId: principal.id,
        mode: input.repeatWeekly ? 'weekly' : 'manual',
        startTime: input.repeatWeekly ? cleanTime(input.startTime) : null,
        updatedAt: now,
        weekday: input.repeatWeekly ? normalizeWeekday(input.weekday) : null,
      })
      .returning({ id: branchLessonScheduleRules.id });

    if (!rule) {
      throw new PublicFlowError('branch_schedule_could_not_be_saved', 409);
    }

    const createdSessions = await transaction
      .insert(lessonSessions)
      .values(
        lessonInputs.map((lesson) => {
          const startsAt = zonedDateTimeToUtc(
            lesson.date,
            lesson.startTime,
            branch.timezone,
          );
          const endsAt = new Date(
            startsAt.getTime() + LESSON_DURATION_MINUTES * 60_000,
          );

          return {
            branchId: branch.id,
            branchScheduleRuleId: rule.id,
            createdByUserId: principal.id,
            endsAt,
            instructorProfileId: branch.instructorProfileId,
            source: 'branch' as const,
            startsAt,
            timezone: branch.timezone,
            updatedAt: now,
          };
        }),
      )
      .returning({ id: lessonSessions.id });

    return {
      branchId: branch.id,
      lessonSessionIds: createdSessions.map((session) => session.id),
    };
  });

  await ensureLessonMeetingsForSessions(result.lessonSessionIds);

  const scheduleByBranch = await getBranchLessonScheduleMap([result.branchId]);
  return {
    branchId: result.branchId,
    schedule: scheduleByBranch.get(result.branchId),
  };
}

export async function getBranchLessonScheduleMap(branchIds: string[]) {
  const ids = Array.from(new Set(branchIds.filter(Boolean)));
  if (!ids.length) return new Map<string, BranchLessonScheduleView>();

  const [rules, sessions] = await Promise.all([
    database
      .select({
        branchId: branchLessonScheduleRules.branchId,
        mode: branchLessonScheduleRules.mode,
        startTime: branchLessonScheduleRules.startTime,
        weekday: branchLessonScheduleRules.weekday,
      })
      .from(branchLessonScheduleRules)
      .where(inArray(branchLessonScheduleRules.branchId, ids)),
    database
      .select({
        branchId: lessonSessions.branchId,
        endsAt: lessonSessions.endsAt,
        id: lessonSessions.id,
        meetingAttempts: lessonSessionMeetings.attempts,
        meetingLastError: lessonSessionMeetings.lastError,
        meetingStatus: lessonSessionMeetings.status,
        startsAt: lessonSessions.startsAt,
        status: lessonSessions.status,
        timezone: lessonSessions.timezone,
      })
      .from(lessonSessions)
      .leftJoin(
        lessonSessionMeetings,
        eq(lessonSessionMeetings.lessonSessionId, lessonSessions.id),
      )
      .where(
        and(
          eq(lessonSessions.source, 'branch'),
          inArray(lessonSessions.branchId, ids),
        ),
      )
      .orderBy(asc(lessonSessions.startsAt)),
  ]);

  const ruleByBranch = new Map(rules.map((rule) => [rule.branchId, rule]));
  const sessionsByBranch = new Map<string, BranchLessonSessionView[]>();
  for (const session of sessions) {
    if (!session.branchId) continue;
    const local = lessonSessionLocalParts(session.startsAt, session.timezone);
    const items = sessionsByBranch.get(session.branchId) ?? [];
    items.push({
      date: local.date,
      endsAt: session.endsAt.toISOString(),
      id: session.id,
      meetingAttempts: session.meetingAttempts ?? undefined,
      meetingLastError: session.meetingLastError ?? undefined,
      meetingStatus: session.meetingStatus ?? undefined,
      startsAt: session.startsAt.toISOString(),
      startTime: local.time,
      status: session.status,
    });
    sessionsByBranch.set(session.branchId, items);
  }

  const result = new Map<string, BranchLessonScheduleView>();
  for (const id of ids) {
    const rule = ruleByBranch.get(id);
    const branchSessions = sessionsByBranch.get(id) ?? [];
    if (!rule && !branchSessions.length) continue;

    result.set(id, {
      repeatWeekly: rule?.mode === 'weekly',
      sessionCount: branchSessions.length,
      sessions: branchSessions,
      startTime: rule?.startTime ?? branchSessions[0]?.startTime,
      weekday: rule?.weekday ?? undefined,
    });
  }

  return result;
}

export async function getAdminCalendarData(
  principal: WorkspacePrincipal,
): Promise<AdminCalendarData> {
  assertAdmin(principal);

  return {
    events: await loadCalendarEvents(),
  };
}

export async function getTeacherCalendarData(
  principal: WorkspacePrincipal,
): Promise<TeacherCalendarData> {
  assertTeacher(principal);

  const [profile] = await database
    .select({
      email: instructorProfiles.email,
      firstName: instructorProfiles.firstName,
      id: instructorProfiles.id,
      lastName: instructorProfiles.lastName,
    })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);

  if (!profile) {
    return { events: [], sessions: [] };
  }

  const events = await loadCalendarEvents(
    eq(lessonSessions.instructorProfileId, profile.id),
  );

  return {
    events,
    instructor: {
      email: profile.email,
      fullName: fullName(profile.firstName, profile.lastName),
      id: profile.id,
    },
    sessions: events,
  };
}

export async function getStudentCalendarData(
  principal: WorkspacePrincipal,
): Promise<StudentCalendarData> {
  assertStudent(principal);

  const [profile] = await database
    .select({
      email: contacts.email,
      firstName: contacts.firstName,
      id: studentProfiles.id,
      lastName: contacts.lastName,
    })
    .from(studentProfiles)
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);

  if (!profile) {
    return { events: [] };
  }

  const activeEnrollmentStatuses = ['active', 'paused'] as const;
  const branchRows = await database
    .select({
      branchId: lessonSessions.branchId,
      branchName: programBranches.name,
      endsAt: lessonSessions.endsAt,
      id: lessonSessions.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      meetingAttempts: lessonSessionMeetings.attempts,
      meetingLastError: lessonSessionMeetings.lastError,
      meetingStatus: lessonSessionMeetings.status,
      programName: programs.name,
      source: lessonSessions.source,
      startsAt: lessonSessions.startsAt,
      status: lessonSessions.status,
      studentFirstName: contacts.firstName,
      studentLastName: contacts.lastName,
      timezone: lessonSessions.timezone,
    })
    .from(lessonSessions)
    .innerJoin(enrollments, eq(enrollments.branchId, lessonSessions.branchId))
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(programBranches, eq(programBranches.id, lessonSessions.branchId))
    .leftJoin(programs, eq(programs.id, programBranches.programId))
    .leftJoin(
      instructorProfiles,
      eq(instructorProfiles.id, lessonSessions.instructorProfileId),
    )
    .leftJoin(
      lessonSessionMeetings,
      eq(lessonSessionMeetings.lessonSessionId, lessonSessions.id),
    )
    .where(
      and(
        eq(lessonSessions.source, 'branch'),
        eq(enrollments.studentId, profile.id),
        inArray(enrollments.status, activeEnrollmentStatuses),
      ),
    )
    .orderBy(asc(lessonSessions.startsAt));
  const privateRows = await database
    .select({
      branchId: lessonSessions.branchId,
      branchName: programBranches.name,
      endsAt: lessonSessions.endsAt,
      id: lessonSessions.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      meetingAttempts: lessonSessionMeetings.attempts,
      meetingLastError: lessonSessionMeetings.lastError,
      meetingStatus: lessonSessionMeetings.status,
      programName: programs.name,
      source: lessonSessions.source,
      startsAt: lessonSessions.startsAt,
      status: lessonSessions.status,
      studentFirstName: contacts.firstName,
      studentLastName: contacts.lastName,
      timezone: lessonSessions.timezone,
    })
    .from(lessonSessions)
    .innerJoin(enrollments, eq(enrollments.id, lessonSessions.enrollmentId))
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(programBranches, eq(programBranches.id, lessonSessions.branchId))
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(
      instructorProfiles,
      eq(instructorProfiles.id, lessonSessions.instructorProfileId),
    )
    .leftJoin(
      lessonSessionMeetings,
      eq(lessonSessionMeetings.lessonSessionId, lessonSessions.id),
    )
    .where(
      and(
        eq(lessonSessions.source, 'private'),
        eq(enrollments.studentId, profile.id),
        inArray(enrollments.status, activeEnrollmentStatuses),
      ),
    )
    .orderBy(asc(lessonSessions.startsAt));

  const googleLinked = await hasLinkedGoogleIdentity(principal.id);
  const absenceRows = await database
    .select({ lessonSessionId: lessonAbsenceReports.lessonSessionId })
    .from(lessonAbsenceReports)
    .where(eq(lessonAbsenceReports.studentProfileId, profile.id));
  const absenceLessonIds = new Set(
    absenceRows.map((row) => row.lessonSessionId),
  );
  const events = dedupeEvents(
    [...branchRows, ...privateRows].map((row) => mapCalendarRow(row)),
  ).map((event) => ({
    ...event,
    absenceReported: absenceLessonIds.has(event.id),
    absenceReportUrl:
      event.status === 'scheduled'
        ? `/api/lessons/${event.id}/absence-report`
        : undefined,
    meetingRetryUrl: undefined,
    requiresGoogleLink: event.meetingStatus === 'ready' && !googleLinked,
  }));

  return {
    events,
    student: {
      email: profile.email,
      fullName: fullName(profile.firstName, profile.lastName),
      id: profile.id,
    },
  };
}

async function loadCalendarEvents(where?: ReturnType<typeof eq>) {
  const base = database
    .select({
      branchId: lessonSessions.branchId,
      branchName: programBranches.name,
      endsAt: lessonSessions.endsAt,
      id: lessonSessions.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      meetingAttempts: lessonSessionMeetings.attempts,
      meetingLastError: lessonSessionMeetings.lastError,
      meetingStatus: lessonSessionMeetings.status,
      programName: programs.name,
      source: lessonSessions.source,
      startsAt: lessonSessions.startsAt,
      status: lessonSessions.status,
      studentFirstName: contacts.firstName,
      studentLastName: contacts.lastName,
      timezone: lessonSessions.timezone,
    })
    .from(lessonSessions)
    .leftJoin(programBranches, eq(programBranches.id, lessonSessions.branchId))
    .leftJoin(programs, eq(programs.id, programBranches.programId))
    .leftJoin(
      instructorProfiles,
      eq(instructorProfiles.id, lessonSessions.instructorProfileId),
    )
    .leftJoin(
      studentProfiles,
      eq(studentProfiles.id, lessonSessions.studentProfileId),
    )
    .leftJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(
      lessonSessionMeetings,
      eq(lessonSessionMeetings.lessonSessionId, lessonSessions.id),
    );

  const rows = where
    ? await base.where(where).orderBy(asc(lessonSessions.startsAt))
    : await base.orderBy(asc(lessonSessions.startsAt));
  const branchCounts = await getBranchStudentCounts(
    rows
      .map((row) => row.branchId)
      .filter((value): value is string => Boolean(value)),
  );

  return rows.map((row) => mapCalendarRow(row, branchCounts));
}

async function getBranchStudentCounts(branchIds: string[]) {
  const ids = Array.from(new Set(branchIds));
  if (!ids.length) return new Map<string, number>();

  const rows = await database
    .select({
      branchId: enrollments.branchId,
      studentCount: drizzleCount(),
    })
    .from(enrollments)
    .where(
      and(
        isNotNull(enrollments.branchId),
        inArray(enrollments.branchId, ids),
        inArray(enrollments.status, ['active', 'paused']),
      ),
    )
    .groupBy(enrollments.branchId);

  return new Map(
    rows
      .filter((row): row is typeof row & { branchId: string } =>
        Boolean(row.branchId),
      )
      .map((row) => [row.branchId, Number(row.studentCount)]),
  );
}

function mapCalendarRow(
  row: LessonCalendarRow,
  branchCounts = new Map<string, number>(),
): CalendarEventView {
  const local = lessonSessionLocalParts(row.startsAt, row.timezone);
  const instructorName =
    row.instructorFirstName && row.instructorLastName
      ? fullName(row.instructorFirstName, row.instructorLastName)
      : undefined;
  const studentName =
    row.studentFirstName && row.studentLastName
      ? fullName(row.studentFirstName, row.studentLastName)
      : undefined;
  const kind: CalendarEventKind =
    row.source === 'branch' ? 'group_lesson' : 'private_lesson';
  const title =
    row.source === 'branch'
      ? (row.branchName ?? row.programName ?? 'Grup dersi')
      : (studentName ?? 'Özel ders');
  const meta = [
    row.programName,
    instructorName,
  ].filter((value): value is string => Boolean(value));

  return {
    branchName: row.branchName ?? undefined,
    date: local.date,
    endsAt: row.endsAt.toISOString(),
    id: row.id,
    instructorName,
    joinUrl:
      row.meetingStatus === 'ready' ? `/api/lessons/${row.id}/join` : undefined,
    kind,
    meta,
    meetingAttempts: row.meetingAttempts ?? undefined,
    meetingLastError: row.meetingLastError ?? undefined,
    meetingProvider: row.meetingStatus ? 'google_meet' : undefined,
    meetingRetryUrl:
      row.meetingStatus === 'failed' ||
      row.meetingStatus === 'disabled' ||
      row.meetingStatus === 'pending'
        ? `/api/lessons/${row.id}/meeting/retry`
        : undefined,
    meetingStatus: row.meetingStatus ?? undefined,
    programName: row.programName ?? undefined,
    source: row.source,
    startsAt: row.startsAt.toISOString(),
    startTime: local.time,
    status: row.status,
    studentCount: row.branchId ? branchCounts.get(row.branchId) : undefined,
    studentName,
    subtitle: row.programName ?? row.branchName ?? undefined,
    title,
  };
}

function dedupeEvents(events: CalendarEventView[]) {
  return Array.from(
    new Map(events.map((event) => [event.id, event])).values(),
  ).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function lessonSessionLocalParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

function normalizeLessonInputs(
  branch: {
    plannedEndDate: string;
    plannedStartDate: string;
    timezone: string;
  },
  input: BranchLessonScheduleInput,
) {
  if (input.repeatWeekly) {
    const weekday = normalizeWeekday(input.weekday);
    const startTime = cleanTime(input.startTime);
    const lessons: BranchLessonInput[] = [];

    for (
      let date = firstDateForWeekday(branch.plannedStartDate, weekday);
      date <= branch.plannedEndDate;
      date = addDays(date, 7)
    ) {
      lessons.push({ date, startTime });
    }

    if (!lessons.length) {
      throw new PublicFlowError('branch_schedule_empty', 400);
    }
    return lessons;
  }

  const lessons = input.lessons ?? [];
  if (!lessons.length || lessons.length > 240) {
    throw new PublicFlowError('branch_schedule_empty', 400);
  }

  return Array.from(
    new Map(
      lessons.map((lesson) => {
        const normalized = {
          date: cleanDate(lesson.date),
          startTime: cleanTime(lesson.startTime),
        };

        if (
          normalized.date < branch.plannedStartDate ||
          normalized.date > branch.plannedEndDate
        ) {
          throw new PublicFlowError('branch_schedule_date_out_of_range', 400);
        }

        return [`${normalized.date}:${normalized.startTime}`, normalized];
      }),
    ).values(),
  ).sort((a, b) =>
    `${a.date}:${a.startTime}`.localeCompare(`${b.date}:${b.startTime}`),
  );
}

function normalizeWeekday(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1 || value > 7) {
    throw new PublicFlowError('branch_schedule_invalid_weekday', 400);
  }
  return value;
}

function cleanDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PublicFlowError('branch_schedule_invalid_date', 400);
  }
  return value;
}

function cleanTime(value?: string) {
  const time = value?.trim() ?? '';
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    throw new PublicFlowError('branch_schedule_invalid_time', 400);
  }
  return time;
}

function firstDateForWeekday(startDate: string, weekday: number) {
  let date = cleanDate(startDate);
  while (isoWeekday(date) !== weekday) {
    date = addDays(date, 1);
  }
  return date;
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function isoWeekday(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = cleanDate(date).split('-').map(Number);
  const [hour, minute] = cleanTime(time).split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(target);

  for (let index = 0; index < 3; index += 1) {
    const local = lessonSessionLocalParts(candidate, timeZone);
    const localAsUtc = Date.UTC(
      Number(local.date.slice(0, 4)),
      Number(local.date.slice(5, 7)) - 1,
      Number(local.date.slice(8, 10)),
      Number(local.time.slice(0, 2)),
      Number(local.time.slice(3, 5)),
    );
    candidate = new Date(candidate.getTime() - (localAsUtc - target));
  }

  return candidate;
}

async function hasLinkedGoogleIdentity(userId: string) {
  const [[account], [identity]] = await Promise.all([
    database
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.userId, userId), eq(accounts.providerId, 'google')),
      )
      .limit(1),
    database
      .select({ id: externalIdentities.id })
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.userId, userId),
          eq(externalIdentities.provider, 'google'),
        ),
      )
      .limit(1),
  ]);

  return Boolean(account && identity);
}

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

function assertTeacher(principal: WorkspacePrincipal) {
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Teacher access is required.');
  }
}

function assertStudent(principal: WorkspacePrincipal) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
