import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  contacts,
  enrollments,
  instructorProfiles,
  lessonChangeRequests,
  lessonSessions,
  programBranches,
  studentProfiles,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { updateLessonSessionOperationalStatus } from './lesson-meetings';
import { createNotifications } from './notification-feed';
import { notificationService } from './notifications';
import { getSetting } from './settings';

const OPEN_LESSON_STATUSES = ['scheduled', 'postponed'] as const;

export type LessonChangeRequestType = 'cancel' | 'postpone';

export type TeacherChangeRequestView = {
  createdAt: string;
  id: string;
  lessonSessionId: string;
  lessonStartsAt: string;
  lessonTitle: string;
  note: string | null;
  requestedStartsAt: string | null;
  source: 'branch' | 'private';
  studentName: string;
  type: LessonChangeRequestType;
};

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function cleanNote(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 1000) : null;
}

// Drizzle wraps pg errors in DrizzleQueryError; the 23505 sits in the cause
// chain (same pattern as payments.ts isUniqueViolation).
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      (current as { code?: string }).code === '23505'
    ) {
      return true;
    }
    current =
      typeof current === 'object' && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}

async function getStudentProfile(userId: string) {
  const [row] = await database
    .select({
      firstName: contacts.firstName,
      id: studentProfiles.id,
      lastName: contacts.lastName,
    })
    .from(studentProfiles)
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .where(eq(studentProfiles.userId, userId))
    .limit(1);

  if (!row) {
    throw new PublicFlowError('student_profile_not_found', 404);
  }

  return { fullName: fullName(row.firstName, row.lastName), id: row.id };
}

export async function createLessonChangeRequest(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
  input: {
    note?: string;
    requestedStartsAt?: string;
    type: LessonChangeRequestType;
  },
) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Only students may request changes.');
  }

  const student = await getStudentProfile(principal.id);

  const [lesson] = await database
    .select({
      branchId: lessonSessions.branchId,
      id: lessonSessions.id,
      instructorProfileId: lessonSessions.instructorProfileId,
      source: lessonSessions.source,
      startsAt: lessonSessions.startsAt,
      status: lessonSessions.status,
      studentProfileId: lessonSessions.studentProfileId,
    })
    .from(lessonSessions)
    .where(eq(lessonSessions.id, lessonSessionId))
    .limit(1);

  if (!lesson) {
    throw new PublicFlowError('lesson_session_not_found', 404);
  }

  const now = Date.now();
  const isOpen = (OPEN_LESSON_STATUSES as readonly string[]).includes(
    lesson.status,
  );
  // No instructor → nobody could ever see or decide the request, so refuse it
  // instead of letting it hang pending forever.
  if (!isOpen || lesson.startsAt.getTime() <= now || !lesson.instructorProfileId) {
    throw new PublicFlowError('lesson_session_not_open', 409);
  }

  if (lesson.source === 'private') {
    if (lesson.studentProfileId !== student.id) {
      throw new AuthorizationDeniedError('Lesson does not belong to student.');
    }
  } else {
    const [membership] = lesson.branchId
      ? await database
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.studentId, student.id),
              eq(enrollments.branchId, lesson.branchId),
              inArray(enrollments.status, ['active', 'paused']),
            ),
          )
          .limit(1)
      : [];
    if (!membership) {
      throw new AuthorizationDeniedError('Lesson does not belong to student.');
    }
  }

  const cutoffHours = await getSetting('lessonChangeCutoffHours');
  if (cutoffHours > 0 && lesson.startsAt.getTime() - now < cutoffHours * 3_600_000) {
    throw new PublicFlowError('lesson_change_cutoff_passed', 409);
  }

  let requestedStartsAt: Date | null = null;
  if (input.type === 'postpone' && input.requestedStartsAt) {
    requestedStartsAt = new Date(input.requestedStartsAt);
    if (
      Number.isNaN(requestedStartsAt.getTime()) ||
      requestedStartsAt.getTime() <= now
    ) {
      throw new PublicFlowError('lesson_change_invalid_time', 400);
    }
  }

  let requestId: string;
  try {
    const [created] = await database
      .insert(lessonChangeRequests)
      .values({
        lessonSessionId,
        note: cleanNote(input.note),
        requestedStartsAt,
        studentProfileId: student.id,
        type: input.type,
      })
      .returning({ id: lessonChangeRequests.id });
    requestId = created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PublicFlowError('lesson_change_already_pending', 409);
    }
    throw error;
  }

  await notifyChangeRequested({
    lessonStartsAt: lesson.startsAt,
    instructorProfileId: lesson.instructorProfileId,
    note: cleanNote(input.note),
    requestId,
    requestedStartsAt,
    studentName: student.fullName,
    type: input.type,
  });

  return { id: requestId };
}

async function notifyChangeRequested(input: {
  instructorProfileId: string | null;
  lessonStartsAt: Date;
  note: string | null;
  requestId: string;
  requestedStartsAt: Date | null;
  studentName: string;
  type: LessonChangeRequestType;
}) {
  if (!input.instructorProfileId) return;

  try {
    const [instructor] = await database
      .select({
        email: instructorProfiles.email,
        userId: instructorProfiles.userId,
      })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.id, input.instructorProfileId))
      .limit(1);
    if (!instructor) return;

    if (instructor.userId) {
      await createNotifications([
        {
          href: '/ogretmen/takvim',
          payload: {
            lessonDate: input.lessonStartsAt.toISOString(),
            student: input.studentName,
            type: input.type,
          },
          type: 'lesson_change_requested',
          userId: instructor.userId,
        },
      ]);
    }

    if (instructor.email) {
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `lesson-change-request:${input.requestId}:${instructor.email}`,
        locale: 'tr',
        payload: {
          lessonDate: input.lessonStartsAt.toISOString(),
          note: input.note ?? '',
          requestedDate: input.requestedStartsAt?.toISOString() ?? '',
          studentName: input.studentName,
          type: input.type,
        },
        recipient: instructor.email,
        templateKey: 'lesson-change-requested',
      });
    }
  } catch {
    // Notification failure must not undo an already-recorded request.
  }
}

export async function decideLessonChangeRequest(
  principal: WorkspacePrincipal,
  requestId: string,
  input: {
    action: 'approve' | 'reject';
    note?: string;
    startsAt?: string;
  },
) {
  // Deliberately teacher-only: there is no admin decision UI, and routing
  // admins through here would bypass the MFA-gated admin path.
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Not allowed to decide requests.');
  }

  const [request] = await database
    .select({
      id: lessonChangeRequests.id,
      instructorProfileId: lessonSessions.instructorProfileId,
      lessonSessionId: lessonChangeRequests.lessonSessionId,
      lessonStartsAt: lessonSessions.startsAt,
      note: lessonChangeRequests.note,
      requestedStartsAt: lessonChangeRequests.requestedStartsAt,
      status: lessonChangeRequests.status,
      studentProfileId: lessonChangeRequests.studentProfileId,
      type: lessonChangeRequests.type,
    })
    .from(lessonChangeRequests)
    .innerJoin(
      lessonSessions,
      eq(lessonSessions.id, lessonChangeRequests.lessonSessionId),
    )
    .where(eq(lessonChangeRequests.id, requestId))
    .limit(1);

  if (!request) {
    throw new PublicFlowError('lesson_change_request_not_found', 404);
  }

  const [profile] = await database
    .select({ id: instructorProfiles.id })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);
  if (!profile || profile.id !== request.instructorProfileId) {
    throw new AuthorizationDeniedError('Request is not manageable.');
  }

  if (request.status !== 'pending') {
    throw new PublicFlowError('lesson_change_request_not_open', 409);
  }

  const decisionNote = cleanNote(input.note);
  const decidedAt = new Date();
  const decision = input.action === 'approve' ? 'approved' : 'rejected';

  if (input.action === 'approve' && request.type === 'postpone') {
    if (!input.startsAt && !request.requestedStartsAt) {
      throw new PublicFlowError('lesson_change_time_required', 400);
    }
  }

  // Claim the request first (atomic on the pending state) so two concurrent
  // decisions can't both apply; roll back the claim if applying the lesson
  // change fails, otherwise the request would be stuck decided with no effect.
  const [claimed] = await database
    .update(lessonChangeRequests)
    .set({
      decidedAt,
      decidedByUserId: principal.id,
      decisionNote,
      status: decision,
      updatedAt: decidedAt,
    })
    .where(
      and(
        eq(lessonChangeRequests.id, requestId),
        eq(lessonChangeRequests.status, 'pending'),
      ),
    )
    .returning({ id: lessonChangeRequests.id });

  if (!claimed) {
    throw new PublicFlowError('lesson_change_request_not_open', 409);
  }

  if (input.action === 'approve') {
    try {
      await updateLessonSessionOperationalStatus(
        principal,
        request.lessonSessionId,
        {
          note: decisionNote ?? request.note ?? undefined,
          startsAt:
            request.type === 'postpone'
              ? (input.startsAt ?? request.requestedStartsAt?.toISOString())
              : undefined,
          status: request.type === 'cancel' ? 'cancelled' : 'postponed',
        },
      );
    } catch (error) {
      // Best-effort revert; if it fails too (e.g. the student already opened a
      // fresh pending request), surface the original error, not the revert's.
      try {
        await database
          .update(lessonChangeRequests)
          .set({
            decidedAt: null,
            decidedByUserId: null,
            decisionNote: null,
            status: 'pending',
            updatedAt: new Date(),
          })
          .where(eq(lessonChangeRequests.id, requestId));
      } catch {
        // ignore
      }
      throw error;
    }
  }

  await notifyRequestDecided({
    decision,
    lessonStartsAt: request.lessonStartsAt,
    note: decisionNote,
    requestId,
    studentProfileId: request.studentProfileId,
    type: request.type,
  });

  return { id: requestId, status: decision };
}

async function notifyRequestDecided(input: {
  decision: 'approved' | 'rejected';
  lessonStartsAt: Date;
  note: string | null;
  requestId: string;
  studentProfileId: string;
  type: LessonChangeRequestType;
}) {
  try {
    const [student] = await database
      .select({
        email: contacts.email,
        userId: studentProfiles.userId,
      })
      .from(studentProfiles)
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(eq(studentProfiles.id, input.studentProfileId))
      .limit(1);
    if (!student) return;

    if (student.userId) {
      await createNotifications([
        {
          href: '/ogrenci/takvim',
          payload: {
            decision: input.decision,
            lessonDate: input.lessonStartsAt.toISOString(),
            type: input.type,
          },
          type: 'lesson_change_request_decided',
          userId: student.userId,
        },
      ]);
    }

    if (student.email) {
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `lesson-change-decision:${input.requestId}:${student.email}`,
        locale: 'tr',
        payload: {
          decision: input.decision,
          lessonDate: input.lessonStartsAt.toISOString(),
          note: input.note ?? '',
          type: input.type,
        },
        recipient: student.email,
        templateKey: 'lesson-change-request-decided',
      });
    }
  } catch {
    // Notification failure must not undo the recorded decision.
  }
}

// Pending requests for the teacher's upcoming open lessons — the decision
// panel on the teacher calendar.
export async function listTeacherChangeRequests(
  principal: WorkspacePrincipal,
): Promise<TeacherChangeRequestView[]> {
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Teacher access is required.');
  }

  const [profile] = await database
    .select({ id: instructorProfiles.id })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);
  if (!profile) return [];

  const rows = await database
    .select({
      branchName: programBranches.name,
      createdAt: lessonChangeRequests.createdAt,
      firstName: contacts.firstName,
      id: lessonChangeRequests.id,
      lastName: contacts.lastName,
      lessonSessionId: lessonChangeRequests.lessonSessionId,
      lessonStartsAt: lessonSessions.startsAt,
      note: lessonChangeRequests.note,
      requestedStartsAt: lessonChangeRequests.requestedStartsAt,
      source: lessonSessions.source,
      type: lessonChangeRequests.type,
    })
    .from(lessonChangeRequests)
    .innerJoin(
      lessonSessions,
      eq(lessonSessions.id, lessonChangeRequests.lessonSessionId),
    )
    .innerJoin(
      studentProfiles,
      eq(studentProfiles.id, lessonChangeRequests.studentProfileId),
    )
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(programBranches, eq(programBranches.id, lessonSessions.branchId))
    .where(
      and(
        eq(lessonChangeRequests.status, 'pending'),
        eq(lessonSessions.instructorProfileId, profile.id),
        inArray(lessonSessions.status, [...OPEN_LESSON_STATUSES]),
      ),
    )
    .orderBy(asc(lessonSessions.startsAt))
    .limit(100);

  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    lessonSessionId: row.lessonSessionId,
    lessonStartsAt: row.lessonStartsAt.toISOString(),
    lessonTitle:
      row.source === 'branch'
        ? (row.branchName ?? '—')
        : fullName(row.firstName, row.lastName),
    note: row.note,
    requestedStartsAt: row.requestedStartsAt?.toISOString() ?? null,
    source: row.source,
    studentName: fullName(row.firstName, row.lastName),
    type: row.type,
  }));
}

