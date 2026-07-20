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
  programBranches,
  programs,
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

function formatLira(cents: number) {
  return `${(cents / 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₺`;
}

// Student reported a bank transfer → tell the receiving teacher (in-app if
// they have an account, always by email to the profile address).
export async function notifyPaymentReported(input: {
  declaredAmountCents: number;
  installmentLabel: string | null;
  instructorId: string;
  paymentId: string;
  studentName: string;
}): Promise<void> {
  try {
    const [instructor] = await database
      .select({
        email: instructorProfiles.email,
        firstName: instructorProfiles.firstName,
        userId: instructorProfiles.userId,
      })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.id, input.instructorId))
      .limit(1);
    if (!instructor) return;

    const amount = formatLira(input.declaredAmountCents);

    if (instructor.userId) {
      await createNotifications([
        {
          userId: instructor.userId,
          type: 'payment_reported',
          payload: { amount, studentName: input.studentName },
          href: '/ogretmen/odemeler',
        },
      ]);
    }

    await notificationService.enqueue({
      channel: 'email',
      idempotencyKey: `payment-reported:${input.paymentId}`,
      locale: 'tr',
      payload: {
        amount,
        installment: input.installmentLabel ?? '',
        name: instructor.firstName,
        studentName: input.studentName,
      },
      recipient: instructor.email,
      templateKey: 'payment-reported',
    });
  } catch (error) {
    logFailure('payment_reported', error);
  }
}

// Teacher (or staff) confirmed the transfer → tell the student.
export async function notifyPaymentConfirmed(input: {
  amountCents: number;
  paymentId: string;
  studentUserId: string | null;
}): Promise<void> {
  try {
    if (!input.studentUserId) return;

    const amount = formatLira(input.amountCents);

    await createNotifications([
      {
        userId: input.studentUserId,
        type: 'payment_confirmed',
        payload: { amount },
        href: '/ogrenci/odemeler',
      },
    ]);

    const [account] = await database
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, input.studentUserId))
      .limit(1);
    if (!account) return;

    await notificationService.enqueue({
      channel: 'email',
      idempotencyKey: `payment-confirmed:${input.paymentId}`,
      locale: 'tr',
      payload: { amount, name: account.name },
      recipient: account.email,
      templateKey: 'payment-confirmed',
    });
  } catch (error) {
    logFailure('payment_confirmed', error);
  }
}

// Teacher rejected the declaration → tell the student in-app and warn staff so
// the mismatch gets chased.
export async function notifyPaymentRejected(input: {
  paymentId: string;
  reason: string;
  studentUserId: string | null;
}): Promise<void> {
  try {
    const entries: NotificationEntry[] = [];

    if (input.studentUserId) {
      entries.push({
        userId: input.studentUserId,
        type: 'payment_rejected',
        payload: { reason: input.reason },
        href: '/ogrenci/odemeler',
      });
    }

    const staff = await database
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.role, ['advisor', 'admin']));

    entries.push(
      ...staff.map((member) => ({
        userId: member.id,
        type: 'payment_rejected' as const,
        payload: { reason: input.reason },
        href:
          member.role === 'advisor' ? '/danisman/odemeler' : '/admin/payments',
      })),
    );

    await createNotifications(entries);
  } catch (error) {
    logFailure('payment_rejected', error);
  }
}

// Admin took the teacher's cash for Zümra's share → receipt-style ping to the
// teacher.
export async function notifySettlementRecorded(input: {
  instructorId: string;
  settlementId: string;
  totalCents: number;
}): Promise<void> {
  try {
    const [instructor] = await database
      .select({ userId: instructorProfiles.userId })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.id, input.instructorId))
      .limit(1);
    if (!instructor?.userId) return;

    await createNotifications([
      {
        userId: instructor.userId,
        type: 'settlement_recorded',
        payload: { amount: formatLira(input.totalCents) },
        href: '/ogretmen/odemeler',
      },
    ]);
  } catch (error) {
    logFailure('settlement_recorded', error);
  }
}

// Sweep: an installment is due soon (or overdue) → remind the student.
export async function notifyInstallmentDue(input: {
  amountCents: number;
  courseLabel: string;
  dueDate: string;
  installmentId: string;
  studentUserId: string;
}): Promise<void> {
  try {
    const amount = formatLira(input.amountCents);

    await createNotifications([
      {
        userId: input.studentUserId,
        type: 'installment_due',
        // installmentId is the sweep's daily dedupe key.
        payload: {
          amount,
          dueDate: input.dueDate,
          installmentId: input.installmentId,
        },
        href: '/ogrenci/odemeler',
      },
    ]);

    const [account] = await database
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, input.studentUserId))
      .limit(1);
    if (!account) return;

    await notificationService.enqueue({
      channel: 'email',
      idempotencyKey: `installment-due:${input.installmentId}:${input.dueDate}:${new Date().toISOString().slice(0, 10)}`,
      locale: 'tr',
      payload: {
        amount,
        course: input.courseLabel,
        dueDate: input.dueDate,
        name: account.name,
      },
      recipient: account.email,
      templateKey: 'installment-due',
    });
  } catch (error) {
    logFailure('installment_due', error);
  }
}

// Sweep: payment reports waited too long for a teacher review → warn staff.
// Admins get the global count; each advisor gets only their own students'.
export async function notifyPaymentReviewStale(input: {
  advisorCounts: Array<{ count: number; userId: string }>;
  totalCount: number;
}): Promise<void> {
  try {
    if (input.totalCount <= 0) return;

    const admins = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'));

    const advisorById = new Map(
      input.advisorCounts.map((entry) => [entry.userId, entry.count]),
    );
    const advisors = advisorById.size
      ? await database
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.role, 'advisor'),
              inArray(users.id, [...advisorById.keys()]),
            ),
          )
      : [];

    await createNotifications([
      ...admins.map((member) => ({
        userId: member.id,
        type: 'payment_review_stale' as const,
        payload: { count: input.totalCount },
        href: '/admin/payments',
      })),
      ...advisors.map((member) => ({
        userId: member.id,
        type: 'payment_review_stale' as const,
        payload: { count: advisorById.get(member.id) ?? 0 },
        href: '/danisman/odemeler',
      })),
    ]);
  } catch (error) {
    logFailure('payment_review_stale', error);
  }
}

// Enrollment completed with an off-catalog discount → flag it to every admin
// (the discount stays valid; this is oversight, not approval).
export async function notifyManualDiscountApplied(input: {
  appliedByName: string;
  discountCents: number;
  enrollmentId: string;
  note: string | null;
}): Promise<void> {
  try {
    const [enrollment] = await database
      .select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(eq(enrollments.id, input.enrollmentId))
      .limit(1);
    if (!enrollment) return;

    const admins = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'));

    await createNotifications(
      admins.map((admin) => ({
        userId: admin.id,
        type: 'manual_discount_applied' as const,
        payload: {
          amount: formatLira(input.discountCents),
          appliedBy: input.appliedByName,
          note: input.note ?? '',
          studentName: fullName(enrollment.firstName, enrollment.lastName),
        },
        href: '/admin/indirimler',
      })),
    );
  } catch (error) {
    logFailure('manual_discount_applied', error);
  }
}

// Branch lesson schedule assigned or replaced → tell the enrolled students and
// the branch teacher on both channels.
export async function notifyBranchScheduleUpdated(input: {
  branchId: string;
  eventKey: string;
}): Promise<void> {
  try {
    const [branch] = await database
      .select({
        branchName: programBranches.name,
        instructorId: programBranches.instructorProfileId,
        programName: programs.name,
      })
      .from(programBranches)
      .innerJoin(programs, eq(programs.id, programBranches.programId))
      .where(eq(programBranches.id, input.branchId))
      .limit(1);
    if (!branch) return;

    const courseLabel = `${branch.programName} — ${branch.branchName}`;

    const students = await database
      .select({
        email: users.email,
        name: users.name,
        userId: studentProfiles.userId,
      })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(
        and(
          eq(enrollments.branchId, input.branchId),
          inArray(enrollments.status, activeEnrollmentStatuses),
        ),
      );

    const entries: NotificationEntry[] = students.map((student) => ({
      userId: student.userId as string,
      type: 'branch_schedule_updated' as const,
      payload: { course: courseLabel },
      href: '/ogrenci/takvim',
    }));

    let instructor: { email: string; name: string; userId: string | null } | null =
      null;

    if (branch.instructorId) {
      const [row] = await database
        .select({
          email: instructorProfiles.email,
          firstName: instructorProfiles.firstName,
          userId: instructorProfiles.userId,
        })
        .from(instructorProfiles)
        .where(eq(instructorProfiles.id, branch.instructorId))
        .limit(1);

      if (row) {
        instructor = {
          email: row.email,
          name: row.firstName,
          userId: row.userId,
        };

        if (row.userId) {
          entries.push({
            userId: row.userId,
            type: 'branch_schedule_updated' as const,
            payload: { course: courseLabel },
            href: '/ogretmen/takvim',
          });
        }
      }
    }

    await createNotifications(entries);

    for (const student of students) {
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `branch-schedule:${input.eventKey}:${student.userId}`,
        locale: 'tr',
        payload: { course: courseLabel, name: student.name },
        recipient: student.email,
        templateKey: 'branch-schedule-updated',
      });
    }

    if (instructor) {
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `branch-schedule:${input.eventKey}:instructor`,
        locale: 'tr',
        payload: { course: courseLabel, name: instructor.name },
        recipient: instructor.email,
        templateKey: 'branch-schedule-updated',
      });
    }
  } catch (error) {
    logFailure('branch_schedule_updated', error);
  }
}
