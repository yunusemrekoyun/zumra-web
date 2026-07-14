import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  assignments,
  assignmentSubmissions,
  contacts,
  conversations,
  enrollments,
  instructorProfiles,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';
import {
  createChatNotification,
  createNotifications,
  type NotificationEntry,
} from './notification-feed';
import { notificationService } from './notifications';

const activeEnrollmentStatuses = ['active', 'paused'] as const;

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function logFailure(event: string, error: unknown) {
  console.error(
    JSON.stringify({
      event: `notify.${event}_failed`,
      message: error instanceof Error ? error.message : 'unknown',
      timestamp: new Date().toISOString(),
    }),
  );
}

// Assignment created → notify the targeted students (email + in-app).
export async function notifyAssignmentAssigned(
  assignmentId: string,
): Promise<void> {
  try {
    const [assignment] = await database
      .select({
        id: assignments.id,
        title: assignments.title,
        targetType: assignments.targetType,
        targetBranchId: assignments.targetBranchId,
        targetEnrollmentId: assignments.targetEnrollmentId,
      })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);
    if (!assignment) return;

    const conditions =
      assignment.targetType === 'branch'
        ? and(
            eq(enrollments.branchId, assignment.targetBranchId as string),
            inArray(enrollments.status, activeEnrollmentStatuses),
          )
        : eq(enrollments.id, assignment.targetEnrollmentId as string);

    const rows = await database
      .select({
        userId: studentProfiles.userId,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(conditions);

    const href = `/ogrenci/odevler/${assignment.id}`;
    const seen = new Set<string>();
    const inApp: NotificationEntry[] = [];
    for (const row of rows) {
      const key = row.userId ?? row.email;
      if (seen.has(key)) continue;
      seen.add(key);
      if (row.userId) {
        inApp.push({
          userId: row.userId,
          type: 'assignment_assigned',
          payload: { title: assignment.title },
          href,
        });
      }
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `assignment-assigned:${assignment.id}:${row.email}`,
        locale: 'tr',
        payload: {
          name: fullName(row.firstName, row.lastName),
          assignmentTitle: assignment.title,
        },
        recipient: row.email,
        templateKey: 'assignment-assigned',
      });
    }
    await createNotifications(inApp);
  } catch (error) {
    logFailure('assignment_assigned', error);
  }
}

// Student submitted → notify the owning instructor.
export async function notifyAssignmentSubmitted(
  submissionId: string,
): Promise<void> {
  try {
    const [row] = await database
      .select({
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        instructorUserId: instructorProfiles.userId,
        instructorEmail: instructorProfiles.email,
        studentFirst: contacts.firstName,
        studentLast: contacts.lastName,
        submittedAt: assignmentSubmissions.submittedAt,
      })
      .from(assignmentSubmissions)
      .innerJoin(
        assignments,
        eq(assignments.id, assignmentSubmissions.assignmentId),
      )
      .innerJoin(
        instructorProfiles,
        eq(instructorProfiles.id, assignments.instructorProfileId),
      )
      .innerJoin(
        studentProfiles,
        eq(studentProfiles.id, assignmentSubmissions.studentProfileId),
      )
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(eq(assignmentSubmissions.id, submissionId))
      .limit(1);
    if (!row) return;

    const studentName = fullName(row.studentFirst, row.studentLast);
    const href = `/ogretmen/odevler/${row.assignmentId}`;
    if (row.instructorUserId) {
      await createNotifications([
        {
          userId: row.instructorUserId,
          type: 'assignment_submitted',
          payload: { assignmentTitle: row.assignmentTitle, studentName },
          href,
        },
      ]);
    }
    if (row.instructorEmail) {
      await notificationService.enqueue({
        channel: 'email',
        // Resubmissions reuse the same submission row, so key on submittedAt:
        // every (re)submission gets its own email — consistent with the in-app
        // notification above — while retries of the same event still dedupe.
        idempotencyKey: `assignment-submitted:${submissionId}:${row.submittedAt.getTime()}`,
        locale: 'tr',
        payload: {
          name: '',
          assignmentTitle: row.assignmentTitle,
          studentName,
        },
        recipient: row.instructorEmail,
        templateKey: 'assignment-submitted',
      });
    }
  } catch (error) {
    logFailure('assignment_submitted', error);
  }
}

// Teacher graded → notify the student.
export async function notifyAssignmentGraded(
  submissionId: string,
): Promise<void> {
  try {
    const [row] = await database
      .select({
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        maxScore: assignments.maxScore,
        score: assignmentSubmissions.score,
        gradedAt: assignmentSubmissions.gradedAt,
        studentUserId: studentProfiles.userId,
        studentEmail: contacts.email,
        studentFirst: contacts.firstName,
        studentLast: contacts.lastName,
      })
      .from(assignmentSubmissions)
      .innerJoin(
        assignments,
        eq(assignments.id, assignmentSubmissions.assignmentId),
      )
      .innerJoin(
        studentProfiles,
        eq(studentProfiles.id, assignmentSubmissions.studentProfileId),
      )
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(eq(assignmentSubmissions.id, submissionId))
      .limit(1);
    if (!row) return;

    const href = `/ogrenci/odevler/${row.assignmentId}`;
    const payload = {
      assignmentTitle: row.assignmentTitle,
      score: row.score ?? 0,
      max: row.maxScore ?? 100,
    };
    if (row.studentUserId) {
      await createNotifications([
        {
          userId: row.studentUserId,
          type: 'assignment_graded',
          payload,
          href,
        },
      ]);
    }
    if (row.studentEmail) {
      await notificationService.enqueue({
        channel: 'email',
        // Re-grades update the same submission row, so key on gradedAt: the
        // corrected-score email goes out — consistent with the in-app
        // notification above — while retries of the same event still dedupe.
        idempotencyKey: `assignment-graded:${submissionId}:${row.gradedAt?.getTime() ?? 0}`,
        locale: 'tr',
        payload: { name: fullName(row.studentFirst, row.studentLast), ...payload },
        recipient: row.studentEmail,
        templateKey: 'assignment-graded',
      });
    }
  } catch (error) {
    logFailure('assignment_graded', error);
  }
}

// New chat message → in-app notification for the other party (no email — would
// be spammy; the unread nav badge already covers reach).
export async function notifyNewMessage(input: {
  conversationId: string;
  senderRole: 'student' | 'instructor';
  preview: string;
}): Promise<void> {
  try {
    const [conv] = await database
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);
    if (!conv) return;

    if (input.senderRole === 'instructor') {
      const [student] = await database
        .select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, conv.studentProfileId))
        .limit(1);
      const [inst] = await database
        .select({
          firstName: instructorProfiles.firstName,
          lastName: instructorProfiles.lastName,
        })
        .from(instructorProfiles)
        .where(eq(instructorProfiles.id, conv.instructorProfileId))
        .limit(1);
      if (student?.userId) {
        await createChatNotification(
          student.userId,
          conv.id,
          {
            fromName: inst ? fullName(inst.firstName, inst.lastName) : '',
            preview: input.preview,
          },
          `/ogrenci/mesajlar?with=${conv.instructorProfileId}`,
        );
      }
    } else {
      const [inst] = await database
        .select({ userId: instructorProfiles.userId })
        .from(instructorProfiles)
        .where(eq(instructorProfiles.id, conv.instructorProfileId))
        .limit(1);
      const [student] = await database
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
        })
        .from(studentProfiles)
        .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
        .where(eq(studentProfiles.id, conv.studentProfileId))
        .limit(1);
      if (inst?.userId) {
        await createChatNotification(
          inst.userId,
          conv.id,
          {
            fromName: student ? fullName(student.firstName, student.lastName) : '',
            preview: input.preview,
          },
          `/ogretmen/mesajlar?with=${conv.studentProfileId}`,
        );
      }
    }
  } catch (error) {
    logFailure('new_message', error);
  }
}

// New public lead (program "bilgi al" / "sizi arayalım" callback) → broadcast an
// in-app notification to every advisor + admin, and send the lead an instant
// welcome email so they stay warm until someone calls.
export async function notifyLeadReceived(input: {
  email: string;
  firstName: string;
  idempotencyKey: string;
  kind: 'callback' | 'program';
  lastName: string;
  locale: 'tr' | 'en';
  programName?: string;
}): Promise<void> {
  try {
    const name = fullName(input.firstName, input.lastName);

    const staff = await database
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.role, ['advisor', 'admin']));

    await createNotifications(
      staff.map((member) => ({
        userId: member.id,
        type: 'lead_received',
        payload: {
          kind: input.kind,
          name,
          program: input.programName ?? '',
        },
        href:
          member.role === 'advisor' ? '/danisman/leadler' : '/admin/leads',
      })),
    );

    await notificationService.enqueue({
      channel: 'email',
      idempotencyKey: `lead-welcome:${input.idempotencyKey}`,
      locale: input.locale,
      payload: { name, program: input.programName ?? '' },
      recipient: input.email,
      templateKey: 'lead-welcome',
    });
  } catch (error) {
    logFailure('lead_received', error);
  }
}
