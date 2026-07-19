import 'server-only';

import { and, eq, gte, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import {
  candidateProfiles,
  enrollmentInstallments,
  enrollments,
  notifications,
  paymentRecords,
  programBranches,
  programs,
  studentProfiles,
} from '@/lib/server/db/schema';
import {
  notifyInstallmentDue,
  notifyPaymentReviewStale,
} from '@/lib/server/services/notify-events';
import { getSetting } from '@/lib/server/services/settings';

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

// Local-frame YYYY-MM-DD so it stays consistent with startOfToday() and the
// local parse of dueDate below (toISOString would shift the day on any host
// running ahead of UTC).
function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Hourly sweep; the NOT EXISTS clause keeps the LIMIT pointed at subjects that
// have not been pinged today, so a large backlog still drains across runs.
export async function sweepInstallmentReminders() {
  const reminderDays = await getSetting('installmentReminderDays');
  const today = startOfToday();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + Math.max(0, reminderDays));

  const dueRows = await database
    .select({
      amountCents: enrollmentInstallments.amountCents,
      branchName: programBranches.name,
      courseMode: enrollments.courseMode,
      dueDate: enrollmentInstallments.dueDate,
      id: enrollmentInstallments.id,
      paidCents: enrollmentInstallments.paidCents,
      programName: programs.name,
      studentUserId: studentProfiles.userId,
    })
    .from(enrollmentInstallments)
    .innerJoin(
      enrollments,
      eq(enrollments.id, enrollmentInstallments.enrollmentId),
    )
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .where(
      and(
        inArray(enrollmentInstallments.status, ['pending', 'partial']),
        lte(enrollmentInstallments.dueDate, isoDate(horizon)),
        inArray(enrollments.status, ['active', 'paused']),
        isNotNull(studentProfiles.userId),
        sql`not exists (
          select 1 from ${notifications}
          where ${notifications.type} = 'installment_due'
            and ${notifications.createdAt} >= ${today}
            and ${notifications.payload}->>'installmentId' = ${enrollmentInstallments.id}::text
        )`,
      ),
    )
    .orderBy(enrollmentInstallments.dueDate)
    .limit(500);

  for (const row of dueRows) {
    if (!row.studentUserId) {
      continue;
    }

    const dueDate = new Date(`${row.dueDate}T00:00:00`);
    const daysUntilDue = Math.round(
      (dueDate.getTime() - today.getTime()) / 86_400_000,
    );

    // One reminder ahead of time, one on the due date, then a weekly nudge
    // while overdue — not a daily drumbeat.
    const shouldRemind =
      daysUntilDue === reminderDays ||
      daysUntilDue === 0 ||
      (daysUntilDue < 0 && Math.abs(daysUntilDue) % 7 === 0);

    if (!shouldRemind) {
      continue;
    }

    await notifyInstallmentDue({
      amountCents: row.amountCents - row.paidCents,
      courseLabel:
        [row.programName, row.branchName].filter(Boolean).join(' — ') ||
        'Kurs kaydı',
      dueDate: row.dueDate,
      installmentId: row.id,
      studentUserId: row.studentUserId,
    });
  }
}

export async function sweepStalePaymentReviews() {
  const staleDays = await getSetting('paymentReviewStaleDays');
  const today = startOfToday();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - Math.max(1, staleDays));

  // Advisors only see their own candidates' ledgers, so each advisor gets
  // their own stale count; admins get the global total.
  const staleByAdvisor = await database
    .select({
      advisorId: candidateProfiles.advisorId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(paymentRecords)
    .innerJoin(enrollments, eq(enrollments.id, paymentRecords.enrollmentId))
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, enrollments.candidateId),
    )
    .where(
      and(
        eq(paymentRecords.status, 'reported'),
        lt(paymentRecords.reportedAt, threshold),
      ),
    )
    .groupBy(candidateProfiles.advisorId);

  const totalCount = staleByAdvisor.reduce((sum, row) => sum + row.count, 0);

  if (!totalCount) {
    return;
  }

  const [alreadyNotified] = await database
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, 'payment_review_stale'),
        gte(notifications.createdAt, today),
      ),
    )
    .limit(1);

  if (alreadyNotified) {
    return;
  }

  await notifyPaymentReviewStale({
    advisorCounts: staleByAdvisor
      .filter((row) => row.advisorId && row.count > 0)
      .map((row) => ({ count: row.count, userId: row.advisorId as string })),
    totalCount,
  });
}
