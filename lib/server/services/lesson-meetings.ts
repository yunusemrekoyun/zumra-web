import 'server-only';

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { tryAcquireAdvisoryLock } from '@/lib/server/db/advisory-lock';
import { database } from '@/lib/server/db/client';
import {
  accounts,
  contacts,
  enrollments,
  externalIdentities,
  instructorProfiles,
  lessonAbsenceReports,
  lessonAttendanceParticipantSessions,
  lessonAttendanceRecords,
  lessonSessionMeetings,
  lessonSessions,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';
import { getGoogleMeetEnv } from '@/lib/server/env';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { notificationService } from '@/lib/server/services/notifications';
import { getSetting } from '@/lib/server/services/settings';
import {
  enqueueMeetAttendanceSync,
  enqueueMeetCreation,
} from '@/lib/server/queues/meet';
import {
  createGoogleMeetSpace,
  endGoogleMeetConference,
  GoogleMeetClientError,
  isGoogleMeetEnabled,
  listGoogleMeetConferenceRecords,
  listGoogleMeetParticipants,
  listGoogleMeetParticipantSessions,
  lockGoogleMeetSpace,
  type GoogleMeetParticipant,
  type GoogleMeetParticipantSession,
} from './google-meet-client';

const ATTENDANCE_SYNC_DELAY_MS = 15 * 60 * 1000;
const PRESENT_THRESHOLD_SECONDS = 35 * 60;
const LATE_THRESHOLD_MS = 10 * 60 * 1000;

// Meet-creation retry policy. A transient failure is retried with exponential
// backoff up to MEET_MAX_ATTEMPTS; a permanent failure (or hitting the cap)
// becomes 'dead' so the reconciliation loop stops hammering Google.
const MEET_MAX_ATTEMPTS = 6;
const MEET_RETRY_BASE_MS = 30 * 1000;
const MEET_RETRY_CAP_MS = 60 * 60 * 1000;

function isTransientMeetError(error: unknown): boolean {
  if (error instanceof GoogleMeetClientError) {
    const status = error.status;
    // No status = network/timeout. 429 + 5xx are retryable; 4xx (401/403/404)
    // mean a config/permission problem that retrying will not fix.
    if (status === undefined) return true;
    return status === 429 || (status >= 500 && status < 600);
  }
  return true;
}

function computeMeetRetryAt(attempts: number): Date {
  const backoff = Math.min(
    MEET_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1),
    MEET_RETRY_CAP_MS,
  );
  const jitter = Math.floor(backoff * 0.2 * Math.random());
  return new Date(Date.now() + backoff + jitter);
}

type AttendanceStatus =
  | 'absent'
  | 'excused'
  | 'late'
  | 'needs_review'
  | 'present';

type LessonSessionOperationalStatus =
  | 'cancelled'
  | 'completed'
  | 'postponed'
  | 'scheduled';

type ExpectedStudent = {
  email: string;
  fullName: string;
  studentProfileId: string;
};

type LessonSessionContext = {
  branchId: string | null;
  enrollmentId: string | null;
  endsAt: Date;
  id: string;
  instructorEmail: string | null;
  instructorProfileId: string | null;
  source: 'branch' | 'private';
  startsAt: Date;
  status: 'cancelled' | 'completed' | 'postponed' | 'scheduled';
};

export async function ensureLessonMeetingsForSessions(
  lessonSessionIds: string[],
) {
  const ids = Array.from(new Set(lessonSessionIds.filter(Boolean)));
  if (!ids.length) return;

  const env = getGoogleMeetEnv();
  const rows = await database
    .select({
      endsAt: lessonSessions.endsAt,
      id: lessonSessions.id,
    })
    .from(lessonSessions)
    .where(inArray(lessonSessions.id, ids));

  if (!rows.length) return;

  const enabled = env.GOOGLE_MEET_ENABLED;
  const now = new Date();
  await database
    .insert(lessonSessionMeetings)
    .values(
      rows.map((session) => ({
        lessonSessionId: session.id,
        nextSyncAt: enabled
          ? new Date(session.endsAt.getTime() + ATTENDANCE_SYNC_DELAY_MS)
          : null,
        organizerEmail: env.GOOGLE_MEET_IMPERSONATED_USER ?? null,
        status: enabled ? ('pending' as const) : ('disabled' as const),
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({
      target: lessonSessionMeetings.lessonSessionId,
    });

  if (!enabled) return;

  for (const session of rows) {
    await enqueueMeetCreation(session.id).catch(() => undefined);
    await enqueueMeetAttendanceSync(
      session.id,
      new Date(session.endsAt.getTime() + ATTENDANCE_SYNC_DELAY_MS),
    ).catch(() => undefined);
  }
}

export async function requeuePendingLessonMeetOperations() {
  await ensureMissingLessonMeetingRecords();

  if (!isGoogleMeetEnabled()) return;

  const pendingMeetings = await database
    .select({ lessonSessionId: lessonSessionMeetings.lessonSessionId })
    .from(lessonSessionMeetings)
    .where(
      or(
        // New work, or 'disabled' rows to (re)create once Meet is enabled.
        inArray(lessonSessionMeetings.status, ['pending', 'disabled']),
        // Retry failures only within the attempt cap and past their backoff.
        and(
          eq(lessonSessionMeetings.status, 'failed'),
          lt(lessonSessionMeetings.attempts, MEET_MAX_ATTEMPTS),
          or(
            isNull(lessonSessionMeetings.nextRetryAt),
            lte(lessonSessionMeetings.nextRetryAt, new Date()),
          ),
        ),
      ),
    )
    .limit(500);

  for (const meeting of pendingMeetings) {
    await enqueueMeetCreation(meeting.lessonSessionId);
  }

  const dueSyncs = await database
    .select({
      lessonSessionId: lessonSessionMeetings.lessonSessionId,
      nextSyncAt: lessonSessionMeetings.nextSyncAt,
    })
    .from(lessonSessionMeetings)
    .where(
      and(
        eq(lessonSessionMeetings.status, 'ready'),
        lte(lessonSessionMeetings.nextSyncAt, new Date()),
      ),
    )
    .limit(500);

  for (const meeting of dueSyncs) {
    await enqueueMeetAttendanceSync(
      meeting.lessonSessionId,
      meeting.nextSyncAt ?? new Date(),
    );
  }
}

export async function ensureMissingLessonMeetingRecords() {
  const missing = await database
    .select({ id: lessonSessions.id })
    .from(lessonSessions)
    .leftJoin(
      lessonSessionMeetings,
      eq(lessonSessionMeetings.lessonSessionId, lessonSessions.id),
    )
    .where(
      and(
        isNull(lessonSessionMeetings.id),
        inArray(lessonSessions.status, ['scheduled', 'postponed']),
      ),
    )
    .limit(500);

  if (!missing.length) return;

  await ensureLessonMeetingsForSessions(missing.map((session) => session.id));
}

export async function createLessonMeetingForSession(lessonSessionId: string) {
  if (!isGoogleMeetEnabled()) {
    await database
      .update(lessonSessionMeetings)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(lessonSessionMeetings.lessonSessionId, lessonSessionId));
    return;
  }

  await ensureLessonMeetingsForSessions([lessonSessionId]);

  const releaseLock = await tryAcquireAdvisoryLock(
    `lesson-meet:${lessonSessionId}`,
  );

  if (!releaseLock) {
    throw new Error('Lesson meeting creation lock is already held.');
  }

  try {
    const now = new Date();
    const [meeting] = await database
      .update(lessonSessionMeetings)
      .set({
        attempts: sql`${lessonSessionMeetings.attempts} + 1`,
        lastError: null,
        status: 'creating',
        updatedAt: now,
      })
      .where(
        and(
          eq(lessonSessionMeetings.lessonSessionId, lessonSessionId),
          inArray(lessonSessionMeetings.status, [
            'disabled',
            'pending',
            'failed',
            'creating',
          ]),
        ),
      )
      .returning({
        id: lessonSessionMeetings.id,
        lessonSessionId: lessonSessionMeetings.lessonSessionId,
      });

    if (!meeting) return;

    const space = await createGoogleMeetSpace();
    const env = getGoogleMeetEnv();
    await database
      .update(lessonSessionMeetings)
      .set({
        lastError: null,
        lastSyncedAt: new Date(),
        meetingCode: space.meetingCode,
        meetingUri: space.meetingUri,
        nextRetryAt: null,
        organizerEmail: env.GOOGLE_MEET_IMPERSONATED_USER,
        spaceName: space.name,
        status: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(lessonSessionMeetings.id, meeting.id));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'meet.create_failed',
        lessonSessionId,
        message:
          error instanceof Error ? error.message.slice(0, 500) : 'unknown',
        status:
          error instanceof GoogleMeetClientError ? error.status : undefined,
        timestamp: new Date().toISOString(),
      }),
    );

    const [current] = await database
      .select({ attempts: lessonSessionMeetings.attempts })
      .from(lessonSessionMeetings)
      .where(eq(lessonSessionMeetings.lessonSessionId, lessonSessionId))
      .limit(1);
    const attempts = current?.attempts ?? 0;
    const permanent =
      !isTransientMeetError(error) || attempts >= MEET_MAX_ATTEMPTS;

    await database
      .update(lessonSessionMeetings)
      .set({
        lastError:
          error instanceof Error ? error.message.slice(0, 500) : 'unknown',
        nextRetryAt: permanent ? null : computeMeetRetryAt(attempts),
        status: permanent ? 'dead' : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(lessonSessionMeetings.lessonSessionId, lessonSessionId));

    throw error;
  } finally {
    await releaseLock();
  }
}

export async function syncLessonAttendanceFromMeet(lessonSessionId: string) {
  if (!isGoogleMeetEnabled()) return;

  const context = await getLessonSessionContext(lessonSessionId);
  const [meeting] = await database
    .select({
      id: lessonSessionMeetings.id,
      spaceName: lessonSessionMeetings.spaceName,
      status: lessonSessionMeetings.status,
    })
    .from(lessonSessionMeetings)
    .where(eq(lessonSessionMeetings.lessonSessionId, lessonSessionId))
    .limit(1);

  if (!context || !meeting || meeting.status !== 'ready' || !meeting.spaceName) {
    return;
  }

  const expectedStudents = await loadExpectedStudents(context);
  const absenceReports = await loadAbsenceReports(lessonSessionId);
  const records = await listGoogleMeetConferenceRecords({
    endedAfter: new Date(context.startsAt.getTime() - 30 * 60_000),
    spaceName: meeting.spaceName,
    startedBefore: new Date(context.endsAt.getTime() + 4 * 60 * 60_000),
  });
  const attendanceByStudent = new Map<
    string,
    {
      firstJoinedAt?: Date;
      lastLeftAt?: Date;
      totalSeconds: number;
    }
  >();

  for (const record of records) {
    const participants = await listGoogleMeetParticipants(record.name);

    for (const participant of participants) {
      const sessions = await listGoogleMeetParticipantSessions(
        participant.name,
      );

      for (const participantSession of sessions) {
        const matchedStudent = await matchParticipantToStudent(participant);
        const normalized = normalizeParticipantSession(participantSession);
        const attendanceRecordId = matchedStudent
          ? await upsertDraftAttendance({
              firstJoinedAt: normalized.joinedAt,
              lastLeftAt: normalized.leftAt,
              lessonSessionId,
              source: 'google_meet',
              status: 'needs_review',
              studentProfileId: matchedStudent,
              suggestedStatus: 'needs_review',
              totalSeconds: normalized.durationSeconds,
            })
          : undefined;

        await database
          .insert(lessonAttendanceParticipantSessions)
          .values({
            anonymous: !participant.signedinUser?.user,
            attendanceRecordId,
            displayName: participantDisplayName(participant),
            durationSeconds: normalized.durationSeconds,
            googleConferenceRecordName: record.name,
            googleParticipantName: participant.name,
            googleParticipantSessionName: participantSession.name,
            googleUser: participant.signedinUser?.user ?? null,
            joinedAt: normalized.joinedAt,
            leftAt: normalized.leftAt,
            lessonSessionId,
            matchConfidence: matchedStudent ? 'matched' : 'unmatched',
            matchedStudentProfileId: matchedStudent ?? null,
            raw: {
              participant,
              participantSession,
            },
          })
          .onConflictDoUpdate({
            target:
              lessonAttendanceParticipantSessions.googleParticipantSessionName,
            set: {
              attendanceRecordId,
              displayName: participantDisplayName(participant),
              durationSeconds: normalized.durationSeconds,
              googleUser: participant.signedinUser?.user ?? null,
              joinedAt: normalized.joinedAt,
              leftAt: normalized.leftAt,
              matchConfidence: matchedStudent ? 'matched' : 'unmatched',
              matchedStudentProfileId: matchedStudent ?? null,
              raw: {
                participant,
                participantSession,
              },
              updatedAt: new Date(),
            },
          });

        if (matchedStudent) {
          const aggregate = attendanceByStudent.get(matchedStudent) ?? {
            totalSeconds: 0,
          };
          aggregate.totalSeconds += normalized.durationSeconds;
          aggregate.firstJoinedAt =
            aggregate.firstJoinedAt && aggregate.firstJoinedAt < normalized.joinedAt
              ? aggregate.firstJoinedAt
              : normalized.joinedAt;
          if (normalized.leftAt) {
            aggregate.lastLeftAt =
              aggregate.lastLeftAt && aggregate.lastLeftAt > normalized.leftAt
                ? aggregate.lastLeftAt
                : normalized.leftAt;
          }
          attendanceByStudent.set(matchedStudent, aggregate);
        }
      }
    }
  }

  for (const student of expectedStudents) {
    const absence = absenceReports.has(student.studentProfileId);
    const aggregate = attendanceByStudent.get(student.studentProfileId);
    const suggestedStatus = absence
      ? 'excused'
      : suggestAttendanceStatus(context.startsAt, aggregate);

    await upsertDraftAttendance({
      firstJoinedAt: aggregate?.firstJoinedAt,
      lastLeftAt: aggregate?.lastLeftAt,
      lessonSessionId,
      source: absence ? 'student_report' : 'google_meet',
      status: suggestedStatus,
      studentProfileId: student.studentProfileId,
      suggestedStatus,
      totalSeconds: aggregate?.totalSeconds ?? 0,
    });
  }

  await database
    .update(lessonSessionMeetings)
    .set({
      lastSyncedAt: new Date(),
      nextSyncAt: null,
      updatedAt: new Date(),
    })
    .where(eq(lessonSessionMeetings.id, meeting.id));
}

export async function submitLessonAbsenceReport(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
  input: { note?: string; reason?: string },
) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const context = await getLessonSessionContext(lessonSessionId);
  if (!context) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  const student = await getStudentProfileForPrincipal(principal.id);
  const expectedStudents = await loadExpectedStudents(context);
  const allowed = expectedStudents.some(
    (item) => item.studentProfileId === student.id,
  );

  if (!allowed) {
    throw new AuthorizationDeniedError('Lesson session is not visible.');
  }

  const [report] = await database
    .insert(lessonAbsenceReports)
    .values({
      lessonSessionId,
      note: cleanText(input.note, 1000),
      reason: cleanText(input.reason, 160),
      studentProfileId: student.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        lessonAbsenceReports.lessonSessionId,
        lessonAbsenceReports.studentProfileId,
      ],
      set: {
        note: cleanText(input.note, 1000),
        reason: cleanText(input.reason, 160),
        status: 'submitted',
        updatedAt: new Date(),
      },
    })
    .returning({ id: lessonAbsenceReports.id });

  await upsertDraftAttendance({
    lessonSessionId,
    source: 'student_report',
    status: 'excused',
    studentProfileId: student.id,
    suggestedStatus: 'excused',
    totalSeconds: 0,
  });

  if (report) {
    await notifyAbsenceReport({
      context,
      lessonSessionId,
      note: cleanText(input.note, 1000),
      reason: cleanText(input.reason, 160),
      reportId: report.id,
      studentName: student.fullName,
    });
  }

  return { id: report?.id };
}

export async function getLessonMeetingJoinUrl(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
) {
  const context = await getLessonSessionContext(lessonSessionId);

  if (!context) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  if (context.status === 'cancelled') {
    throw new PublicFlowError('lesson_session_cancelled', 409);
  }

  if (context.status === 'completed') {
    throw new PublicFlowError('lesson_session_closed', 409);
  }

  const joinLeadMinutes = await getSetting('joinLeadMinutes');
  if (Date.now() < context.startsAt.getTime() - joinLeadMinutes * 60_000) {
    throw new PublicFlowError('lesson_not_open_yet', 409);
  }

  await assertCanJoinLesson(principal, context);

  if (principal.role === 'student') {
    const linked = await hasLinkedGoogleAccount(principal.id);
    if (!linked) {
      throw new PublicFlowError('google_account_required', 409);
    }
  }

  const [meeting] = await database
    .select({
      meetingUri: lessonSessionMeetings.meetingUri,
      status: lessonSessionMeetings.status,
    })
    .from(lessonSessionMeetings)
    .where(eq(lessonSessionMeetings.lessonSessionId, lessonSessionId))
    .limit(1);

  if (!meeting || meeting.status !== 'ready' || !meeting.meetingUri) {
    throw new PublicFlowError('lesson_meeting_not_ready', 409);
  }

  return meeting.meetingUri;
}

export async function retryLessonMeetingCreation(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
) {
  const context = await getLessonSessionContext(lessonSessionId);

  if (!context) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  await assertCanManageLesson(principal, context);

  if (!isGoogleMeetEnabled()) {
    throw new PublicFlowError('google_meet_disabled', 409);
  }

  const env = getGoogleMeetEnv();
  await database
    .insert(lessonSessionMeetings)
    .values({
      lastError: null,
      lessonSessionId,
      nextSyncAt: new Date(
        context.endsAt.getTime() + ATTENDANCE_SYNC_DELAY_MS,
      ),
      organizerEmail: env.GOOGLE_MEET_IMPERSONATED_USER,
      status: 'pending',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: lessonSessionMeetings.lessonSessionId,
      set: {
        attempts: 0,
        lastError: null,
        nextRetryAt: null,
        nextSyncAt: new Date(
          context.endsAt.getTime() + ATTENDANCE_SYNC_DELAY_MS,
        ),
        organizerEmail: env.GOOGLE_MEET_IMPERSONATED_USER,
        status: 'pending',
        updatedAt: new Date(),
      },
    });

  await enqueueMeetCreation(lessonSessionId);
  return { status: 'queued' as const };
}

// Does the teacher or the student already have an open (scheduled/postponed)
// lesson overlapping this window? Used to guard postpone against double-booking.
async function hasOverlappingOpenLesson(params: {
  instructorProfileId: string | null;
  studentProfileId: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeId: string;
}): Promise<boolean> {
  const scope = [];
  if (params.instructorProfileId) {
    scope.push(eq(lessonSessions.instructorProfileId, params.instructorProfileId));
  }
  if (params.studentProfileId) {
    scope.push(eq(lessonSessions.studentProfileId, params.studentProfileId));
  }
  if (!scope.length) return false;

  const [row] = await database
    .select({ id: lessonSessions.id })
    .from(lessonSessions)
    .where(
      and(
        ne(lessonSessions.id, params.excludeId),
        inArray(lessonSessions.status, ['scheduled', 'postponed']),
        lt(lessonSessions.startsAt, params.endsAt),
        gt(lessonSessions.endsAt, params.startsAt),
        or(...scope),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function updateLessonSessionOperationalStatus(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
  input: {
    note?: string;
    startsAt?: string;
    status: LessonSessionOperationalStatus;
  },
) {
  const context = await getLessonSessionContext(lessonSessionId);

  if (!context) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  await assertCanManageLesson(principal, context);

  // A completed/cancelled lesson is terminal — never re-open or re-time it.
  // The UI gates this client-side, but a direct POST must be rejected too.
  if (context.status !== 'scheduled' && context.status !== 'postponed') {
    throw new PublicFlowError('lesson_session_not_open', 409);
  }

  const updatedStartsAt =
    input.status === 'postponed' && input.startsAt
      ? parseOperationalDate(input.startsAt)
      : undefined;
  const durationMs = context.endsAt.getTime() - context.startsAt.getTime();
  const updatedEndsAt = updatedStartsAt
    ? new Date(updatedStartsAt.getTime() + durationMs)
    : undefined;

  // Postpone must move the lesson to a future slot that doesn't clash with the
  // teacher's or the student's other open lessons (mirrors the create flow).
  if (input.status === 'postponed') {
    if (
      !updatedStartsAt ||
      !updatedEndsAt ||
      updatedStartsAt.getTime() <= Date.now()
    ) {
      throw new PublicFlowError('lesson_postpone_invalid', 400);
    }
    const [session] = await database
      .select({ studentProfileId: lessonSessions.studentProfileId })
      .from(lessonSessions)
      .where(eq(lessonSessions.id, lessonSessionId))
      .limit(1);
    const clash = await hasOverlappingOpenLesson({
      excludeId: lessonSessionId,
      instructorProfileId: context.instructorProfileId,
      studentProfileId: session?.studentProfileId ?? null,
      startsAt: updatedStartsAt,
      endsAt: updatedEndsAt,
    });
    if (clash) {
      throw new PublicFlowError('lesson_postpone_conflict', 409);
    }
  }

  const [updated] = await database
    .update(lessonSessions)
    .set({
      endsAt: updatedEndsAt,
      startsAt: updatedStartsAt,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(lessonSessions.id, lessonSessionId))
    .returning({
      endsAt: lessonSessions.endsAt,
      id: lessonSessions.id,
      startsAt: lessonSessions.startsAt,
      status: lessonSessions.status,
    });

  if (!updated) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  // Re-arm attendance sync for the new end time so the reconciliation sweep
  // doesn't fire against the old (now-past) time and mark everyone absent.
  if (updatedStartsAt) {
    await database
      .update(lessonSessionMeetings)
      .set({
        nextSyncAt: new Date(
          updated.endsAt.getTime() + ATTENDANCE_SYNC_DELAY_MS,
        ),
        updatedAt: new Date(),
      })
      .where(eq(lessonSessionMeetings.lessonSessionId, lessonSessionId));
  }

  // A normal "completed" close is not a disruption, so it does not fan out
  // status-change emails the way cancel/postpone do.
  if (updated.status !== 'completed') {
    await notifyLessonSessionStatusChange({
      context: {
        ...context,
        endsAt: updated.endsAt,
        startsAt: updated.startsAt,
        status: updated.status,
      },
      lessonSessionId,
      note: cleanText(input.note, 1000),
      status: updated.status,
    });
  }

  // Cancelling or completing a lesson closes its Meet access so the raw link
  // can no longer be reused.
  if (updated.status === 'cancelled' || updated.status === 'completed') {
    await closeLessonMeetingAccess([lessonSessionId]);
  }

  return {
    endsAt: updated.endsAt.toISOString(),
    id: updated.id,
    startsAt: updated.startsAt.toISOString(),
    status: updated.status,
  };
}

function logMeetCloseError(op: string, spaceName: string, error: unknown) {
  console.error(
    JSON.stringify({
      event: 'meet.close_failed',
      message: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
      op,
      spaceName,
      timestamp: new Date().toISOString(),
    }),
  );
}

// Closes Meet access for ended/cancelled lessons: locks each space to
// RESTRICTED (so the raw link stops auto-admitting) and ends any live
// conference. Best-effort — failures never block the lesson-status change, and
// conferenceRecords survive so post-hoc attendance sync still works.
export async function closeLessonMeetingAccess(
  lessonSessionIds: string[],
): Promise<void> {
  if (!isGoogleMeetEnabled() || !lessonSessionIds.length) return;

  const meetings = await database
    .select({ spaceName: lessonSessionMeetings.spaceName })
    .from(lessonSessionMeetings)
    .where(
      and(
        inArray(lessonSessionMeetings.lessonSessionId, lessonSessionIds),
        eq(lessonSessionMeetings.status, 'ready'),
      ),
    );

  for (const meeting of meetings) {
    if (!meeting.spaceName) continue;
    const spaceName = meeting.spaceName;
    await lockGoogleMeetSpace(spaceName).catch((error) =>
      logMeetCloseError('lock', spaceName, error),
    );
    await endGoogleMeetConference(spaceName).catch((error) =>
      logMeetCloseError('end', spaceName, error),
    );
  }
}

// Safety net: closes lessons the teacher forgot to end. Runs from the worker
// sweep. Flips lesson status to 'completed' (join then blocked) and closes the
// Meet access; does NOT delete conferenceRecords, so attendance still syncs.
export async function autoCloseStaleLessons(): Promise<number> {
  const autoCloseHours = await getSetting('lessonAutoCloseHours');
  const cutoff = new Date(Date.now() - autoCloseHours * 60 * 60 * 1000);
  const closed = await database
    .update(lessonSessions)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(
      and(
        inArray(lessonSessions.status, ['scheduled', 'postponed']),
        lt(lessonSessions.startsAt, cutoff),
      ),
    )
    .returning({ id: lessonSessions.id });

  await closeLessonMeetingAccess(closed.map((row) => row.id));

  return closed.length;
}

export async function getLessonAttendanceDraft(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
) {
  const context = await getLessonSessionContext(lessonSessionId);

  if (!context) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  await assertCanManageLesson(principal, context);

  const [expectedStudents, records, participantRows] = await Promise.all([
    loadExpectedStudents(context),
    database
      .select({
        confirmedAt: lessonAttendanceRecords.confirmedAt,
        firstJoinedAt: lessonAttendanceRecords.firstJoinedAt,
        id: lessonAttendanceRecords.id,
        lastLeftAt: lessonAttendanceRecords.lastLeftAt,
        source: lessonAttendanceRecords.source,
        status: lessonAttendanceRecords.status,
        studentProfileId: lessonAttendanceRecords.studentProfileId,
        suggestedStatus: lessonAttendanceRecords.suggestedStatus,
        teacherNote: lessonAttendanceRecords.teacherNote,
        totalSeconds: lessonAttendanceRecords.totalSeconds,
      })
      .from(lessonAttendanceRecords)
      .where(eq(lessonAttendanceRecords.lessonSessionId, lessonSessionId)),
    database
      .select({
        displayName: lessonAttendanceParticipantSessions.displayName,
        durationSeconds: lessonAttendanceParticipantSessions.durationSeconds,
        googleUser: lessonAttendanceParticipantSessions.googleUser,
        id: lessonAttendanceParticipantSessions.id,
        joinedAt: lessonAttendanceParticipantSessions.joinedAt,
        leftAt: lessonAttendanceParticipantSessions.leftAt,
        matchConfidence:
          lessonAttendanceParticipantSessions.matchConfidence,
      })
      .from(lessonAttendanceParticipantSessions)
      .where(
        and(
          eq(
            lessonAttendanceParticipantSessions.lessonSessionId,
            lessonSessionId,
          ),
          eq(lessonAttendanceParticipantSessions.matchConfidence, 'unmatched'),
        ),
      ),
  ]);
  const recordByStudent = new Map(
    records.map((record) => [record.studentProfileId, record]),
  );

  return {
    lessonSessionId,
    students: expectedStudents.map((student) => {
      const record = recordByStudent.get(student.studentProfileId);
      return {
        email: student.email,
        firstJoinedAt: record?.firstJoinedAt?.toISOString(),
        fullName: student.fullName,
        lastLeftAt: record?.lastLeftAt?.toISOString(),
        recordId: record?.id,
        source: record?.source,
        status: record?.status ?? 'needs_review',
        studentProfileId: student.studentProfileId,
        suggestedStatus: record?.suggestedStatus,
        teacherNote: record?.teacherNote ?? undefined,
        totalSeconds: record?.totalSeconds ?? 0,
      };
    }),
    unmatchedParticipants: participantRows.map((row) => ({
      displayName: row.displayName,
      durationSeconds: row.durationSeconds,
      googleUser: row.googleUser,
      id: row.id,
      joinedAt: row.joinedAt.toISOString(),
      leftAt: row.leftAt?.toISOString(),
      matchConfidence: row.matchConfidence,
    })),
  };
}

export async function confirmLessonAttendance(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
  input: {
    records: Array<{
      status: AttendanceStatus;
      studentProfileId: string;
      teacherNote?: string;
    }>;
  },
) {
  const context = await getLessonSessionContext(lessonSessionId);

  if (!context) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  await assertCanManageLesson(principal, context);

  const expectedStudents = await loadExpectedStudents(context);
  const expectedIds = new Set(
    expectedStudents.map((student) => student.studentProfileId),
  );
  const now = new Date();

  for (const record of input.records) {
    if (!expectedIds.has(record.studentProfileId)) {
      throw new AuthorizationDeniedError('Student is not in this lesson.');
    }
  }

  await database.transaction(async (transaction) => {
    for (const record of input.records) {
      await transaction
        .insert(lessonAttendanceRecords)
        .values({
          confirmedAt: now,
          confirmedByUserId: principal.id,
          lessonSessionId,
          source: 'teacher',
          status: record.status,
          studentProfileId: record.studentProfileId,
          suggestedStatus: record.status,
          teacherNote: cleanText(record.teacherNote, 1000),
          totalSeconds: 0,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            lessonAttendanceRecords.lessonSessionId,
            lessonAttendanceRecords.studentProfileId,
          ],
          set: {
            confirmedAt: now,
            confirmedByUserId: principal.id,
            source: 'teacher',
            status: record.status,
            suggestedStatus: record.status,
            teacherNote: cleanText(record.teacherNote, 1000),
            updatedAt: now,
          },
        });
    }
  });

  return getLessonAttendanceDraft(principal, lessonSessionId);
}

async function getLessonSessionContext(
  lessonSessionId: string,
): Promise<LessonSessionContext | undefined> {
  const [row] = await database
    .select({
      branchId: lessonSessions.branchId,
      enrollmentId: lessonSessions.enrollmentId,
      endsAt: lessonSessions.endsAt,
      id: lessonSessions.id,
      instructorEmail: instructorProfiles.email,
      instructorProfileId: lessonSessions.instructorProfileId,
      source: lessonSessions.source,
      startsAt: lessonSessions.startsAt,
      status: lessonSessions.status,
    })
    .from(lessonSessions)
    .leftJoin(
      instructorProfiles,
      eq(instructorProfiles.id, lessonSessions.instructorProfileId),
    )
    .where(eq(lessonSessions.id, lessonSessionId))
    .limit(1);

  return row;
}

async function loadExpectedStudents(context: LessonSessionContext) {
  const activeEnrollmentStatuses = ['active', 'paused'] as const;

  if (context.source === 'branch' && context.branchId) {
    const rows = await database
      .select({
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        studentProfileId: studentProfiles.id,
      })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(
        and(
          eq(enrollments.branchId, context.branchId),
          inArray(enrollments.status, activeEnrollmentStatuses),
        ),
      )
      .orderBy(asc(contacts.lastName), asc(contacts.firstName));

    return rows.map((row) => ({
      email: row.email,
      fullName: fullName(row.firstName, row.lastName),
      studentProfileId: row.studentProfileId,
    }));
  }

  if (context.source === 'private' && context.enrollmentId) {
    const rows = await database
      .select({
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        studentProfileId: studentProfiles.id,
      })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(
        and(
          eq(enrollments.id, context.enrollmentId),
          inArray(enrollments.status, activeEnrollmentStatuses),
        ),
      )
      .limit(1);

    return rows.map((row) => ({
      email: row.email,
      fullName: fullName(row.firstName, row.lastName),
      studentProfileId: row.studentProfileId,
    }));
  }

  return [] satisfies ExpectedStudent[];
}

async function loadAbsenceReports(lessonSessionId: string) {
  const rows = await database
    .select({ studentProfileId: lessonAbsenceReports.studentProfileId })
    .from(lessonAbsenceReports)
    .where(
      and(
        eq(lessonAbsenceReports.lessonSessionId, lessonSessionId),
        eq(lessonAbsenceReports.status, 'submitted'),
      ),
    );

  return new Set(rows.map((row) => row.studentProfileId));
}

async function matchParticipantToStudent(
  participant: GoogleMeetParticipant,
) {
  const googleUser = participant.signedinUser?.user;
  if (!googleUser) return undefined;

  const providerAccountCandidate = googleUser.replace(/^users\//, '');
  const [identity] = await database
    .select({ userId: externalIdentities.userId })
    .from(externalIdentities)
    .where(
      or(
        eq(externalIdentities.meetUserId, googleUser),
        eq(externalIdentities.providerAccountId, googleUser),
        eq(externalIdentities.providerAccountId, providerAccountCandidate),
      ),
    )
    .limit(1);

  if (!identity) return undefined;

  const [student] = await database
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, identity.userId))
    .limit(1);

  if (!student) return undefined;

  await database
    .update(externalIdentities)
    .set({ meetUserId: googleUser, updatedAt: new Date() })
    .where(eq(externalIdentities.userId, identity.userId))
    .catch(() => undefined);

  return student.id;
}

async function upsertDraftAttendance(input: {
  firstJoinedAt?: Date;
  lastLeftAt?: Date;
  lessonSessionId: string;
  source: 'google_meet' | 'student_report' | 'system' | 'teacher';
  status: AttendanceStatus;
  studentProfileId: string;
  suggestedStatus: AttendanceStatus;
  totalSeconds: number;
}) {
  const [existing] = await database
    .select({
      confirmedAt: lessonAttendanceRecords.confirmedAt,
      id: lessonAttendanceRecords.id,
    })
    .from(lessonAttendanceRecords)
    .where(
      and(
        eq(lessonAttendanceRecords.lessonSessionId, input.lessonSessionId),
        eq(lessonAttendanceRecords.studentProfileId, input.studentProfileId),
      ),
    )
    .limit(1);

  if (existing?.confirmedAt) return existing.id;

  const [record] = await database
    .insert(lessonAttendanceRecords)
    .values({
      firstJoinedAt: input.firstJoinedAt,
      lastLeftAt: input.lastLeftAt,
      lessonSessionId: input.lessonSessionId,
      source: input.source,
      status: input.status,
      studentProfileId: input.studentProfileId,
      suggestedStatus: input.suggestedStatus,
      totalSeconds: input.totalSeconds,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        lessonAttendanceRecords.lessonSessionId,
        lessonAttendanceRecords.studentProfileId,
      ],
      set: {
        firstJoinedAt: input.firstJoinedAt,
        lastLeftAt: input.lastLeftAt,
        source: input.source,
        status: input.status,
        suggestedStatus: input.suggestedStatus,
        totalSeconds: input.totalSeconds,
        updatedAt: new Date(),
      },
    })
    .returning({ id: lessonAttendanceRecords.id });

  return record?.id;
}

async function assertCanJoinLesson(
  principal: WorkspacePrincipal,
  context: LessonSessionContext,
) {
  if (principal.role === 'admin') return;

  if (principal.role === 'teacher') {
    const [profile] = await database
      .select({ id: instructorProfiles.id })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.userId, principal.id))
      .limit(1);

    if (profile?.id === context.instructorProfileId) return;
  }

  if (principal.role === 'student') {
    const student = await getStudentProfileForPrincipal(principal.id);
    const expected = await loadExpectedStudents(context);

    if (
      expected.some((item) => item.studentProfileId === student.id)
    ) {
      return;
    }
  }

  throw new AuthorizationDeniedError('Lesson session is not visible.');
}

async function assertCanManageLesson(
  principal: WorkspacePrincipal,
  context: LessonSessionContext,
) {
  if (principal.role === 'admin') return;

  if (principal.role === 'teacher') {
    const [profile] = await database
      .select({ id: instructorProfiles.id })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.userId, principal.id))
      .limit(1);

    if (profile?.id === context.instructorProfileId) return;
  }

  throw new AuthorizationDeniedError('Lesson session is not manageable.');
}

async function getStudentProfileForPrincipal(userId: string) {
  const [student] = await database
    .select({
      firstName: contacts.firstName,
      id: studentProfiles.id,
      lastName: contacts.lastName,
    })
    .from(studentProfiles)
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .where(eq(studentProfiles.userId, userId))
    .limit(1);

  if (!student) {
    throw new PublicFlowError('student_profile_not_found', 404);
  }

  return {
    fullName: fullName(student.firstName, student.lastName),
    id: student.id,
  };
}

async function hasLinkedGoogleAccount(userId: string) {
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

function normalizeParticipantSession(
  participantSession: GoogleMeetParticipantSession,
) {
  const joinedAt = new Date(participantSession.startTime);
  const leftAt = participantSession.endTime
    ? new Date(participantSession.endTime)
    : undefined;
  const durationSeconds = Math.max(
    0,
    Math.floor(((leftAt ?? new Date()).getTime() - joinedAt.getTime()) / 1000),
  );

  return { durationSeconds, joinedAt, leftAt };
}

function participantDisplayName(participant: GoogleMeetParticipant) {
  return (
    participant.signedinUser?.displayName ??
    participant.anonymousUser?.displayName ??
    participant.phoneUser?.displayName ??
    'Google Meet participant'
  );
}

function suggestAttendanceStatus(
  startsAt: Date,
  aggregate?: {
    firstJoinedAt?: Date;
    totalSeconds: number;
  },
): AttendanceStatus {
  if (!aggregate || aggregate.totalSeconds <= 0) return 'absent';
  if (aggregate.totalSeconds < PRESENT_THRESHOLD_SECONDS) return 'needs_review';
  if (
    aggregate.firstJoinedAt &&
    aggregate.firstJoinedAt.getTime() - startsAt.getTime() > LATE_THRESHOLD_MS
  ) {
    return 'late';
  }
  return 'present';
}

async function notifyAbsenceReport(input: {
  context: LessonSessionContext;
  lessonSessionId: string;
  note?: string;
  reason?: string;
  reportId: string;
  studentName: string;
}) {
  const adminRows = await database
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.accountStatus, 'active')));
  const recipients = new Set(adminRows.map((row) => row.email));

  if (input.context.instructorEmail) {
    recipients.add(input.context.instructorEmail);
  }

  await Promise.all(
    Array.from(recipients).map((recipient) =>
      notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `lesson-absence:${input.reportId}:${recipient}`,
        locale: 'tr',
        payload: {
          lessonDate: input.context.startsAt.toISOString(),
          note: input.note ?? '',
          reason: input.reason ?? '',
          studentName: input.studentName,
        },
        recipient,
        templateKey: 'lesson-absence-report',
      }),
    ),
  );

  await database
    .update(lessonAbsenceReports)
    .set({ notifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(lessonAbsenceReports.id, input.reportId));
}

async function notifyLessonSessionStatusChange(input: {
  context: LessonSessionContext;
  lessonSessionId: string;
  note?: string;
  status: LessonSessionOperationalStatus | 'completed';
}) {
  const [expectedStudents, adminRows] = await Promise.all([
    loadExpectedStudents(input.context),
    database
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.accountStatus, 'active'))),
  ]);
  const recipients = new Set([
    ...adminRows.map((row) => row.email),
    ...expectedStudents.map((student) => student.email),
  ]);

  if (input.context.instructorEmail) {
    recipients.add(input.context.instructorEmail);
  }

  await Promise.all(
    Array.from(recipients).map((recipient) =>
      notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `lesson-status:${input.lessonSessionId}:${input.status}:${recipient}`,
        locale: 'tr',
        payload: {
          lessonDate: input.context.startsAt.toISOString(),
          note: input.note ?? '',
          status: input.status,
        },
        recipient,
        templateKey: 'lesson-session-status-updated',
      }),
    ),
  );
}

function parseOperationalDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PublicFlowError('lesson_session_invalid_date', 400);
  }
  return date;
}

function cleanText(value: string | undefined, maxLength: number) {
  const clean = value?.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
