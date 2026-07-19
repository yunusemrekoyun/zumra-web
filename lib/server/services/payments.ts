import 'server-only';

import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { formatIban } from '@/lib/domain/iban';
import {
  isoToIstanbulWallClock,
  istanbulWallClockToISO,
} from '@/lib/datetime';
import { database } from '@/lib/server/db/client';
import {
  candidateProfiles,
  commissionRates,
  contacts,
  enrollmentInstallments,
  enrollments,
  instructorBankAccounts,
  instructorProfiles,
  mediaAssets,
  paymentRecords,
  privateLessonStudentRates,
  programBranches,
  programs,
  studentProfiles,
  teacherSettlements,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { decryptIban, protectIban } from '@/lib/server/security/bank-account';
import {
  notifyPaymentConfirmed,
  notifyPaymentRejected,
  notifyPaymentReported,
  notifySettlementRecorded,
} from '@/lib/server/services/notify-events';

type DatabaseClient = typeof database;
type TransactionClient = Parameters<
  Parameters<DatabaseClient['transaction']>[0]
>[0];

const LIST_LIMIT = 200;

export type InstallmentView = {
  id: string;
  sequence: number;
  label: string | null;
  amountCents: number;
  paidCents: number;
  dueDate: string;
  status: 'pending' | 'partial' | 'paid';
  note: string | null;
};

export type PaymentRecordView = {
  id: string;
  enrollmentId: string;
  installmentId: string | null;
  installmentLabel: string | null;
  status: 'reported' | 'confirmed' | 'rejected';
  declaredAmountCents: number | null;
  amountCents: number | null;
  method: string | null;
  studentNote: string | null;
  reviewNote: string | null;
  receiptMediaAssetId: string | null;
  reportedAt: string;
  reviewedAt: string | null;
  settled: boolean;
  studentName: string;
  courseLabel: string;
  instructorId: string;
  instructorName: string;
  zumraShareCents: number | null;
  teacherShareBasisPoints: number | null;
};

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

function installmentLabel(
  sequence: number | null,
  label: string | null,
): string | null {
  if (label) {
    return label;
  }

  return sequence === null ? null : `#${sequence}`;
}

function courseLabel(row: {
  branchName: string | null;
  programName: string | null;
  courseMode: 'group' | 'private';
  privateLanguage?: string | null;
}) {
  if (row.courseMode === 'group') {
    return [row.programName, row.branchName].filter(Boolean).join(' — ');
  }

  return row.programName ?? 'Özel ders';
}

async function requireTeacherProfile(
  principal: WorkspacePrincipal,
  client: DatabaseClient | TransactionClient = database,
) {
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Teacher access is required.');
  }

  const [profile] = await client
    .select({
      firstName: instructorProfiles.firstName,
      id: instructorProfiles.id,
      lastName: instructorProfiles.lastName,
    })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);

  if (!profile) {
    throw new AuthorizationDeniedError('Instructor profile not found.');
  }

  return profile;
}

// Advisors only handle their own candidates' enrollments; admins see all.
async function assertStaffCanAccessEnrollment(
  principal: WorkspacePrincipal,
  enrollmentId: string,
  client: DatabaseClient | TransactionClient = database,
) {
  assertStaff(principal);

  if (principal.role === 'admin') {
    return;
  }

  const [row] = await client
    .select({ advisorId: candidateProfiles.advisorId })
    .from(enrollments)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, enrollments.candidateId),
    )
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!row || row.advisorId !== principal.id) {
    throw new AuthorizationDeniedError('Enrollment is outside your scope.');
  }
}

// The teacher who actually receives the money: the branch teacher for group
// enrollments, the selected instructor for private ones.
async function resolveEnrollmentInstructor(
  enrollmentId: string,
  client: DatabaseClient | TransactionClient = database,
) {
  const [row] = await client
    .select({
      branchId: enrollments.branchId,
      branchInstructorId: programBranches.instructorProfileId,
      courseMode: enrollments.courseMode,
      id: enrollments.id,
      selectedInstructorProfileId: enrollments.selectedInstructorProfileId,
      status: enrollments.status,
      studentId: enrollments.studentId,
    })
    .from(enrollments)
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!row) {
    throw new PublicFlowError('enrollment_not_found', 404);
  }

  const instructorId =
    row.courseMode === 'group'
      ? row.branchInstructorId
      : row.selectedInstructorProfileId;

  if (!instructorId) {
    throw new PublicFlowError('enrollment_instructor_missing', 409);
  }

  return { enrollment: row, instructorId };
}

async function activeBankAccount(
  instructorId: string,
  client: DatabaseClient | TransactionClient = database,
) {
  const [account] = await client
    .select({
      holderName: instructorBankAccounts.holderName,
      ibanEncrypted: instructorBankAccounts.ibanEncrypted,
      ibanLastFour: instructorBankAccounts.ibanLastFour,
      id: instructorBankAccounts.id,
    })
    .from(instructorBankAccounts)
    .where(
      and(
        eq(instructorBankAccounts.instructorId, instructorId),
        isNull(instructorBankAccounts.archivedAt),
      ),
    )
    .limit(1);

  return account ?? null;
}

// Commission lookup at confirmation time: branch rate for group enrollments,
// the instructor's private rate otherwise. Missing rate blocks confirmation so
// money never enters the ledger without a defined split.
async function resolveCommission(
  enrollment: { branchId: string | null; courseMode: 'group' | 'private' },
  instructorId: string,
  client: DatabaseClient | TransactionClient = database,
) {
  const condition =
    enrollment.courseMode === 'group' && enrollment.branchId
      ? and(
          eq(commissionRates.scope, 'branch'),
          eq(commissionRates.branchId, enrollment.branchId),
        )
      : and(
          eq(commissionRates.scope, 'instructor_private'),
          eq(commissionRates.instructorId, instructorId),
        );

  const [rate] = await client
    .select({
      teacherShareBasisPoints: commissionRates.teacherShareBasisPoints,
    })
    .from(commissionRates)
    .where(condition)
    .limit(1);

  if (!rate) {
    throw new PublicFlowError('commission_rate_missing', 409);
  }

  return rate.teacherShareBasisPoints;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      (current as { code?: unknown }).code === '23505' &&
      (current as { constraint?: unknown }).constraint === constraint
    ) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

// A receipt must be the caller's own finished upload — otherwise an arbitrary
// media id could satisfy the mandatory-receipt rule and canReadPaymentReceipt
// would widen access to a stranger's file.
async function assertReceiptOwnedAndReady(
  transaction: TransactionClient,
  principal: WorkspacePrincipal,
  mediaAssetId: string,
) {
  const [asset] = await transaction
    .select({
      ownerUserId: mediaAssets.ownerUserId,
      status: mediaAssets.status,
      visibility: mediaAssets.visibility,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaAssetId))
    .limit(1);

  if (
    !asset ||
    asset.ownerUserId !== principal.id ||
    asset.status !== 'ready' ||
    asset.visibility !== 'private'
  ) {
    throw new PublicFlowError('attachment_forbidden', 403);
  }
}

function splitAmount(amountCents: number, teacherShareBasisPoints: number) {
  const teacherCents = Math.round(
    (amountCents * teacherShareBasisPoints) / 10_000,
  );

  return { teacherCents, zumraCents: amountCents - teacherCents };
}

async function applyInstallmentPayment(
  transaction: TransactionClient,
  installmentId: string,
  deltaCents: number,
) {
  const [installment] = await transaction
    .select({
      amountCents: enrollmentInstallments.amountCents,
      paidCents: enrollmentInstallments.paidCents,
    })
    .from(enrollmentInstallments)
    .where(eq(enrollmentInstallments.id, installmentId))
    .limit(1)
    .for('update');

  if (!installment) {
    throw new PublicFlowError('installment_not_found', 404);
  }

  const paidCents = Math.max(0, installment.paidCents + deltaCents);
  const status =
    paidCents >= installment.amountCents
      ? 'paid'
      : paidCents > 0
        ? 'partial'
        : 'pending';

  await transaction
    .update(enrollmentInstallments)
    .set({ paidCents, status, updatedAt: new Date() })
    .where(eq(enrollmentInstallments.id, installmentId));
}

const paymentListSelection = {
  amountCents: paymentRecords.amountCents,
  branchName: programBranches.name,
  courseMode: enrollments.courseMode,
  declaredAmountCents: paymentRecords.declaredAmountCents,
  enrollmentId: paymentRecords.enrollmentId,
  id: paymentRecords.id,
  installmentId: paymentRecords.installmentId,
  installmentRowLabel: enrollmentInstallments.label,
  installmentSequence: enrollmentInstallments.sequence,
  instructorFirstName: instructorProfiles.firstName,
  instructorId: paymentRecords.instructorId,
  instructorLastName: instructorProfiles.lastName,
  method: paymentRecords.method,
  programName: programs.name,
  receiptMediaAssetId: paymentRecords.receiptMediaAssetId,
  reportedAt: paymentRecords.reportedAt,
  reviewNote: paymentRecords.reviewNote,
  reviewedAt: paymentRecords.reviewedAt,
  settlementId: paymentRecords.settlementId,
  status: paymentRecords.status,
  studentFirstName: contacts.firstName,
  studentLastName: contacts.lastName,
  studentNote: paymentRecords.studentNote,
  teacherShareBasisPoints: paymentRecords.teacherShareBasisPoints,
  zumraShareCents: paymentRecords.zumraShareCents,
};

type PaymentListRow = {
  amountCents: number | null;
  branchName: string | null;
  courseMode: 'group' | 'private';
  declaredAmountCents: number | null;
  enrollmentId: string;
  id: string;
  installmentId: string | null;
  installmentRowLabel: string | null;
  installmentSequence: number | null;
  instructorFirstName: string;
  instructorId: string;
  instructorLastName: string;
  method: string | null;
  programName: string | null;
  receiptMediaAssetId: string | null;
  reportedAt: Date;
  reviewNote: string | null;
  reviewedAt: Date | null;
  settlementId: string | null;
  status: 'reported' | 'confirmed' | 'rejected';
  studentFirstName: string;
  studentLastName: string;
  studentNote: string | null;
  teacherShareBasisPoints: number | null;
  zumraShareCents: number | null;
};

function toPaymentView(row: PaymentListRow): PaymentRecordView {
  return {
    amountCents: row.amountCents,
    courseLabel: courseLabel(row),
    declaredAmountCents: row.declaredAmountCents,
    enrollmentId: row.enrollmentId,
    id: row.id,
    installmentId: row.installmentId,
    installmentLabel: installmentLabel(
      row.installmentSequence,
      row.installmentRowLabel,
    ),
    instructorId: row.instructorId,
    instructorName:
      `${row.instructorFirstName} ${row.instructorLastName}`.trim(),
    method: row.method,
    receiptMediaAssetId: row.receiptMediaAssetId,
    reportedAt: row.reportedAt.toISOString(),
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    settled: row.settlementId !== null,
    status: row.status,
    studentName: `${row.studentFirstName} ${row.studentLastName}`.trim(),
    studentNote: row.studentNote,
    teacherShareBasisPoints: row.teacherShareBasisPoints,
    zumraShareCents: row.zumraShareCents,
  };
}

function paymentListQuery(client: DatabaseClient | TransactionClient) {
  return client
    .select(paymentListSelection)
    .from(paymentRecords)
    .innerJoin(enrollments, eq(enrollments.id, paymentRecords.enrollmentId))
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, paymentRecords.instructorId),
    )
    .leftJoin(
      enrollmentInstallments,
      eq(enrollmentInstallments.id, paymentRecords.installmentId),
    )
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .leftJoin(programs, eq(programs.id, enrollments.programId));
}

/* ------------------------------------------------------------------------- */
/* Student                                                                    */
/* ------------------------------------------------------------------------- */

export async function getStudentPaymentOverview(principal: WorkspacePrincipal) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const studentEnrollments = await database
    .select({
      branchInstructorId: programBranches.instructorProfileId,
      branchName: programBranches.name,
      courseMode: enrollments.courseMode,
      enrolledAt: enrollments.enrolledAt,
      finalPriceCents: enrollments.finalPriceCents,
      id: enrollments.id,
      programName: programs.name,
      selectedInstructorProfileId: enrollments.selectedInstructorProfileId,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .where(eq(studentProfiles.userId, principal.id))
    .orderBy(desc(enrollments.enrolledAt));

  if (!studentEnrollments.length) {
    return { enrollments: [] };
  }

  const enrollmentIds = studentEnrollments.map((row) => row.id);
  const instructorIds = [
    ...new Set(
      studentEnrollments
        .map((row) =>
          row.courseMode === 'group'
            ? row.branchInstructorId
            : row.selectedInstructorProfileId,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [installments, records, instructors, accounts] = await Promise.all([
    database
      .select({
        amountCents: enrollmentInstallments.amountCents,
        dueDate: enrollmentInstallments.dueDate,
        enrollmentId: enrollmentInstallments.enrollmentId,
        id: enrollmentInstallments.id,
        label: enrollmentInstallments.label,
        note: enrollmentInstallments.note,
        paidCents: enrollmentInstallments.paidCents,
        sequence: enrollmentInstallments.sequence,
        status: enrollmentInstallments.status,
      })
      .from(enrollmentInstallments)
      .where(inArray(enrollmentInstallments.enrollmentId, enrollmentIds))
      .orderBy(enrollmentInstallments.sequence),
    paymentListQuery(database)
      .where(inArray(paymentRecords.enrollmentId, enrollmentIds))
      .orderBy(desc(paymentRecords.reportedAt))
      .limit(LIST_LIMIT),
    instructorIds.length
      ? database
          .select({
            firstName: instructorProfiles.firstName,
            id: instructorProfiles.id,
            lastName: instructorProfiles.lastName,
          })
          .from(instructorProfiles)
          .where(inArray(instructorProfiles.id, instructorIds))
      : Promise.resolve([]),
    instructorIds.length
      ? database
          .select({
            holderName: instructorBankAccounts.holderName,
            ibanEncrypted: instructorBankAccounts.ibanEncrypted,
            instructorId: instructorBankAccounts.instructorId,
          })
          .from(instructorBankAccounts)
          .where(
            and(
              inArray(instructorBankAccounts.instructorId, instructorIds),
              isNull(instructorBankAccounts.archivedAt),
            ),
          )
      : Promise.resolve([]),
  ]);

  const instructorById = new Map(instructors.map((row) => [row.id, row]));
  const accountByInstructor = new Map(
    accounts.map((row) => [row.instructorId, row]),
  );

  return {
    enrollments: studentEnrollments.map((row) => {
      const instructorId =
        row.courseMode === 'group'
          ? row.branchInstructorId
          : row.selectedInstructorProfileId;
      const instructor = instructorId
        ? instructorById.get(instructorId)
        : undefined;
      const account = instructorId
        ? accountByInstructor.get(instructorId)
        : undefined;

      return {
        bankAccount: account
          ? {
              holderName: account.holderName,
              iban: formatIban(decryptIban(account.ibanEncrypted)),
            }
          : null,
        courseLabel: courseLabel(row),
        courseMode: row.courseMode,
        id: row.id,
        installments: installments
          .filter((installment) => installment.enrollmentId === row.id)
          .map(
            (installment): InstallmentView => ({
              amountCents: installment.amountCents,
              dueDate: installment.dueDate,
              id: installment.id,
              label: installment.label,
              note: installment.note,
              paidCents: installment.paidCents,
              sequence: installment.sequence,
              status: installment.status,
            }),
          ),
        instructorName: instructor
          ? `${instructor.firstName} ${instructor.lastName}`.trim()
          : null,
        // The commission split and settlement state are internal accounting —
        // the student's view never carries them.
        payments: records
          .filter((record) => record.enrollmentId === row.id)
          .map((record) => {
            const { settled, teacherShareBasisPoints, zumraShareCents, ...view } =
              toPaymentView(record);
            void settled;
            void teacherShareBasisPoints;
            void zumraShareCents;
            return view;
          }),
        status: row.status,
      };
    }),
  };
}

export async function reportStudentPayment(
  principal: WorkspacePrincipal,
  input: {
    amountCents: number;
    enrollmentId: string;
    installmentId: string;
    note?: string;
  },
) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const report = async () => database.transaction(async (transaction) => {
    const [owner] = await transaction
      .select({ userId: studentProfiles.userId })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
      .where(eq(enrollments.id, input.enrollmentId))
      .limit(1);

    if (!owner || owner.userId !== principal.id) {
      throw new AuthorizationDeniedError('Enrollment is outside your scope.');
    }

    const [installment] = await transaction
      .select({
        enrollmentId: enrollmentInstallments.enrollmentId,
        id: enrollmentInstallments.id,
        label: enrollmentInstallments.label,
        sequence: enrollmentInstallments.sequence,
        status: enrollmentInstallments.status,
      })
      .from(enrollmentInstallments)
      .where(eq(enrollmentInstallments.id, input.installmentId))
      .limit(1);

    if (!installment || installment.enrollmentId !== input.enrollmentId) {
      throw new PublicFlowError('installment_not_found', 404);
    }

    if (installment.status === 'paid') {
      throw new PublicFlowError('installment_already_paid', 409);
    }

    const [openReport] = await transaction
      .select({ id: paymentRecords.id })
      .from(paymentRecords)
      .where(
        and(
          eq(paymentRecords.installmentId, input.installmentId),
          eq(paymentRecords.status, 'reported'),
        ),
      )
      .limit(1);

    if (openReport) {
      throw new PublicFlowError('payment_already_reported', 409);
    }

    const { enrollment, instructorId } = await resolveEnrollmentInstructor(
      input.enrollmentId,
      transaction,
    );

    if (enrollment.status === 'cancelled') {
      throw new PublicFlowError('enrollment_not_payable', 409);
    }

    const account = await activeBankAccount(instructorId, transaction);

    const [record] = await transaction
      .insert(paymentRecords)
      .values({
        bankAccountId: account?.id ?? null,
        declaredAmountCents: input.amountCents,
        enrollmentId: input.enrollmentId,
        installmentId: input.installmentId,
        instructorId,
        method: 'bank_transfer',
        reportedByUserId: principal.id,
        status: 'reported',
        studentNote: input.note?.trim() || null,
      })
      .returning({ id: paymentRecords.id });

    return {
      installmentLabel: installmentLabel(
        installment.sequence,
        installment.label,
      ),
      instructorId,
      paymentId: record.id,
    };
  });

  let result: Awaited<ReturnType<typeof report>>;

  try {
    result = await report();
  } catch (error) {
    // The partial unique index is what actually enforces the one-open-report
    // rule under concurrency; translate its violation to the same error the
    // pre-check produces.
    if (isUniqueViolation(error, 'payment_records_open_report_unique')) {
      throw new PublicFlowError('payment_already_reported', 409);
    }

    throw error;
  }

  await notifyPaymentReported({
    declaredAmountCents: input.amountCents,
    installmentLabel: result.installmentLabel,
    instructorId: result.instructorId,
    paymentId: result.paymentId,
    studentName: principal.name,
  });

  return { paymentId: result.paymentId };
}

/* ------------------------------------------------------------------------- */
/* Teacher                                                                    */
/* ------------------------------------------------------------------------- */

export async function getTeacherPaymentWorkspace(
  principal: WorkspacePrincipal,
) {
  const profile = await requireTeacherProfile(principal);

  const [pending, history, rates, privateRate, settlements, account, totals] =
    await Promise.all([
      paymentListQuery(database)
        .where(
          and(
            eq(paymentRecords.instructorId, profile.id),
            eq(paymentRecords.status, 'reported'),
          ),
        )
        .orderBy(desc(paymentRecords.reportedAt))
        .limit(LIST_LIMIT),
      paymentListQuery(database)
        .where(
          and(
            eq(paymentRecords.instructorId, profile.id),
            inArray(paymentRecords.status, ['confirmed', 'rejected']),
          ),
        )
        .orderBy(desc(paymentRecords.reportedAt))
        .limit(LIST_LIMIT),
      database
        .select({
          branchName: programBranches.name,
          programName: programs.name,
          teacherShareBasisPoints: commissionRates.teacherShareBasisPoints,
        })
        .from(commissionRates)
        .innerJoin(
          programBranches,
          eq(programBranches.id, commissionRates.branchId),
        )
        .innerJoin(programs, eq(programs.id, programBranches.programId))
        .where(
          and(
            eq(commissionRates.scope, 'branch'),
            eq(programBranches.instructorProfileId, profile.id),
          ),
        ),
      database
        .select({
          teacherShareBasisPoints: commissionRates.teacherShareBasisPoints,
        })
        .from(commissionRates)
        .where(
          and(
            eq(commissionRates.scope, 'instructor_private'),
            eq(commissionRates.instructorId, profile.id),
          ),
        )
        .limit(1),
      database
        .select({
          id: teacherSettlements.id,
          note: teacherSettlements.note,
          receivedAt: teacherSettlements.receivedAt,
          totalCents: teacherSettlements.totalCents,
        })
        .from(teacherSettlements)
        .where(eq(teacherSettlements.instructorId, profile.id))
        .orderBy(desc(teacherSettlements.receivedAt))
        .limit(50),
      activeBankAccount(profile.id),
      database
        .select({
          confirmedCents:
            sql<number>`coalesce(sum(${paymentRecords.amountCents}), 0)`.mapWith(
              Number,
            ),
          unsettledZumraCents: sql<number>`coalesce(sum(${paymentRecords.zumraShareCents}) filter (where ${paymentRecords.settlementId} is null), 0)`.mapWith(
            Number,
          ),
          zumraCents:
            sql<number>`coalesce(sum(${paymentRecords.zumraShareCents}), 0)`.mapWith(
              Number,
            ),
        })
        .from(paymentRecords)
        .where(
          and(
            eq(paymentRecords.instructorId, profile.id),
            eq(paymentRecords.status, 'confirmed'),
          ),
        ),
    ]);

  const summary = totals[0] ?? {
    confirmedCents: 0,
    unsettledZumraCents: 0,
    zumraCents: 0,
  };

  return {
    bankAccount: account
      ? {
          holderName: account.holderName,
          iban: formatIban(decryptIban(account.ibanEncrypted)),
        }
      : null,
    commissionRates: {
      branches: rates.map((rate) => ({
        courseLabel: [rate.programName, rate.branchName]
          .filter(Boolean)
          .join(' — '),
        teacherShareBasisPoints: rate.teacherShareBasisPoints,
      })),
      privateShareBasisPoints:
        privateRate[0]?.teacherShareBasisPoints ?? null,
    },
    history: history.map(toPaymentView),
    pending: pending.map(toPaymentView),
    settlements: settlements.map((settlement) => ({
      id: settlement.id,
      note: settlement.note,
      receivedAt: settlement.receivedAt.toISOString(),
      totalCents: settlement.totalCents,
    })),
    totals: {
      confirmedCents: summary.confirmedCents,
      teacherCents: summary.confirmedCents - summary.zumraCents,
      unsettledZumraCents: summary.unsettledZumraCents,
      zumraCents: summary.zumraCents,
    },
  };
}

async function loadReviewablePayment(
  transaction: TransactionClient,
  principal: WorkspacePrincipal,
  paymentId: string,
) {
  const [record] = await transaction
    .select({
      branchId: enrollments.branchId,
      courseMode: enrollments.courseMode,
      declaredAmountCents: paymentRecords.declaredAmountCents,
      enrollmentId: paymentRecords.enrollmentId,
      id: paymentRecords.id,
      installmentId: paymentRecords.installmentId,
      instructorId: paymentRecords.instructorId,
      instructorUserId: instructorProfiles.userId,
      status: paymentRecords.status,
      studentUserId: studentProfiles.userId,
    })
    .from(paymentRecords)
    .innerJoin(enrollments, eq(enrollments.id, paymentRecords.enrollmentId))
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, paymentRecords.instructorId),
    )
    .where(eq(paymentRecords.id, paymentId))
    .limit(1)
    .for('update', { of: paymentRecords });

  if (!record) {
    throw new PublicFlowError('payment_not_found', 404);
  }

  const isOwnTeacher =
    principal.role === 'teacher' && record.instructorUserId === principal.id;
  const isStaff = principal.role === 'admin' || principal.role === 'advisor';

  if (!isOwnTeacher && !isStaff) {
    throw new AuthorizationDeniedError('Payment is outside your scope.');
  }

  if (principal.role === 'advisor') {
    await assertStaffCanAccessEnrollment(
      principal,
      record.enrollmentId,
      transaction,
    );
  }

  if (record.status !== 'reported') {
    throw new PublicFlowError('payment_not_reviewable', 409);
  }

  return record;
}

export async function confirmPaymentRecord(
  principal: WorkspacePrincipal,
  input: {
    amountCents: number;
    paymentId: string;
    receiptMediaAssetId?: string;
    reviewNote?: string;
  },
) {
  if (input.amountCents <= 0) {
    throw new PublicFlowError('invalid_amount', 400);
  }

  // Teachers must attach the bank receipt; staff entries may omit it.
  if (principal.role === 'teacher' && !input.receiptMediaAssetId) {
    throw new PublicFlowError('receipt_required', 400);
  }

  const result = await database.transaction(async (transaction) => {
    const record = await loadReviewablePayment(
      transaction,
      principal,
      input.paymentId,
    );

    if (input.receiptMediaAssetId) {
      await assertReceiptOwnedAndReady(
        transaction,
        principal,
        input.receiptMediaAssetId,
      );
    }

    const teacherShareBasisPoints = await resolveCommission(
      record,
      record.instructorId,
      transaction,
    );
    const { zumraCents } = splitAmount(
      input.amountCents,
      teacherShareBasisPoints,
    );

    await transaction
      .update(paymentRecords)
      .set({
        amountCents: input.amountCents,
        receiptMediaAssetId: input.receiptMediaAssetId ?? null,
        reviewNote: input.reviewNote?.trim() || null,
        reviewedAt: new Date(),
        reviewedByUserId: principal.id,
        status: 'confirmed',
        teacherShareBasisPoints,
        updatedAt: new Date(),
        zumraShareCents: zumraCents,
      })
      .where(eq(paymentRecords.id, record.id));

    if (record.installmentId) {
      await applyInstallmentPayment(
        transaction,
        record.installmentId,
        input.amountCents,
      );
    }

    return record;
  });

  await notifyPaymentConfirmed({
    amountCents: input.amountCents,
    paymentId: result.id,
    studentUserId: result.studentUserId,
  });

  return { paymentId: result.id };
}

export async function rejectPaymentRecord(
  principal: WorkspacePrincipal,
  input: { paymentId: string; reason: string },
) {
  const reason = input.reason.trim();

  if (!reason) {
    throw new PublicFlowError('reason_required', 400);
  }

  const result = await database.transaction(async (transaction) => {
    const record = await loadReviewablePayment(
      transaction,
      principal,
      input.paymentId,
    );

    await transaction
      .update(paymentRecords)
      .set({
        reviewNote: reason,
        reviewedAt: new Date(),
        reviewedByUserId: principal.id,
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(paymentRecords.id, record.id));

    return record;
  });

  await notifyPaymentRejected({
    paymentId: result.id,
    reason,
    studentUserId: result.studentUserId,
  });

  return { paymentId: result.id };
}

/* ------------------------------------------------------------------------- */
/* Staff ledger                                                               */
/* ------------------------------------------------------------------------- */

export async function createStaffPayment(
  principal: WorkspacePrincipal,
  input: {
    amountCents: number;
    enrollmentId: string;
    installmentId?: string;
    method?: string;
    note?: string;
    receiptMediaAssetId?: string;
  },
) {
  assertStaff(principal);

  if (input.amountCents <= 0) {
    throw new PublicFlowError('invalid_amount', 400);
  }

  const result = await database.transaction(async (transaction) => {
    await assertStaffCanAccessEnrollment(
      principal,
      input.enrollmentId,
      transaction,
    );

    const { enrollment, instructorId } = await resolveEnrollmentInstructor(
      input.enrollmentId,
      transaction,
    );

    if (input.installmentId) {
      const [installment] = await transaction
        .select({ enrollmentId: enrollmentInstallments.enrollmentId })
        .from(enrollmentInstallments)
        .where(eq(enrollmentInstallments.id, input.installmentId))
        .limit(1);

      if (!installment || installment.enrollmentId !== input.enrollmentId) {
        throw new PublicFlowError('installment_not_found', 404);
      }
    }

    if (input.receiptMediaAssetId) {
      await assertReceiptOwnedAndReady(
        transaction,
        principal,
        input.receiptMediaAssetId,
      );
    }

    const teacherShareBasisPoints = await resolveCommission(
      enrollment,
      instructorId,
      transaction,
    );
    const { zumraCents } = splitAmount(
      input.amountCents,
      teacherShareBasisPoints,
    );
    const account = await activeBankAccount(instructorId, transaction);

    const [record] = await transaction
      .insert(paymentRecords)
      .values({
        amountCents: input.amountCents,
        bankAccountId: account?.id ?? null,
        declaredAmountCents: input.amountCents,
        enrollmentId: input.enrollmentId,
        installmentId: input.installmentId ?? null,
        instructorId,
        method: input.method?.trim() || 'bank_transfer',
        receiptMediaAssetId: input.receiptMediaAssetId ?? null,
        reportedByUserId: principal.id,
        reviewNote: input.note?.trim() || null,
        reviewedAt: new Date(),
        reviewedByUserId: principal.id,
        status: 'confirmed',
        teacherShareBasisPoints,
        zumraShareCents: zumraCents,
      })
      .returning({ id: paymentRecords.id });

    if (input.installmentId) {
      await applyInstallmentPayment(
        transaction,
        input.installmentId,
        input.amountCents,
      );
    }

    return record;
  });

  return { paymentId: result.id };
}

export async function listStaffPayments(
  principal: WorkspacePrincipal,
  filters: {
    instructorId?: string;
    query?: string;
    status?: 'reported' | 'confirmed' | 'rejected';
  } = {},
  limit = LIST_LIMIT,
) {
  assertStaff(principal);

  const conditions = [];

  if (filters.status) {
    conditions.push(eq(paymentRecords.status, filters.status));
  }

  if (filters.instructorId) {
    conditions.push(eq(paymentRecords.instructorId, filters.instructorId));
  }

  if (principal.role === 'advisor') {
    conditions.push(eq(candidateProfiles.advisorId, principal.id));
  }

  if (filters.query?.trim()) {
    const like = `%${filters.query.trim()}%`;
    conditions.push(
      sql`(${contacts.firstName} || ' ' || ${contacts.lastName}) ilike ${like}`,
    );
  }

  const rows = await paymentListQuery(database)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, enrollments.candidateId),
    )
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(paymentRecords.reportedAt))
    .limit(limit);

  return rows.map(toPaymentView);
}

// Feeds the staff "record payment" modal and the advisor plan editor: the
// enrollments this staff member may collect for, with their installment rows.
export async function listPayableEnrollments(principal: WorkspacePrincipal) {
  assertStaff(principal);

  const conditions = [inArray(enrollments.status, ['active', 'paused'])];

  if (principal.role === 'advisor') {
    conditions.push(eq(candidateProfiles.advisorId, principal.id));
  }

  const rows = await database
    .select({
      branchName: programBranches.name,
      courseMode: enrollments.courseMode,
      id: enrollments.id,
      programName: programs.name,
      studentFirstName: contacts.firstName,
      studentLastName: contacts.lastName,
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, enrollments.candidateId),
    )
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .where(and(...conditions))
    .orderBy(contacts.firstName, contacts.lastName)
    .limit(500);

  if (!rows.length) {
    return [];
  }

  const installments = await database
    .select({
      amountCents: enrollmentInstallments.amountCents,
      dueDate: enrollmentInstallments.dueDate,
      enrollmentId: enrollmentInstallments.enrollmentId,
      id: enrollmentInstallments.id,
      label: enrollmentInstallments.label,
      note: enrollmentInstallments.note,
      paidCents: enrollmentInstallments.paidCents,
      sequence: enrollmentInstallments.sequence,
      status: enrollmentInstallments.status,
    })
    .from(enrollmentInstallments)
    .where(
      inArray(
        enrollmentInstallments.enrollmentId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(enrollmentInstallments.sequence);

  return rows.map((row) => ({
    courseLabel: courseLabel(row),
    id: row.id,
    installments: installments
      .filter((installment) => installment.enrollmentId === row.id)
      .map(
        (installment): InstallmentView => ({
          amountCents: installment.amountCents,
          dueDate: installment.dueDate,
          id: installment.id,
          label: installment.label,
          note: installment.note,
          paidCents: installment.paidCents,
          sequence: installment.sequence,
          status: installment.status,
        }),
      ),
    studentName: `${row.studentFirstName} ${row.studentLastName}`.trim(),
  }));
}

export async function getAdminPaymentStats(principal: WorkspacePrincipal) {
  assertAdmin(principal);

  // The ledger's calendar is Istanbul wall clock, independent of server TZ.
  const today = isoToIstanbulWallClock(new Date().toISOString()).slice(0, 10);
  const monthStart = new Date(
    istanbulWallClockToISO(`${today.slice(0, 7)}-01T00:00`),
  );

  const [paymentTotals, overdue] = await Promise.all([
    database
      .select({
        monthConfirmedCents: sql<number>`coalesce(sum(${paymentRecords.amountCents}) filter (where ${paymentRecords.status} = 'confirmed' and ${paymentRecords.reviewedAt} >= ${monthStart}), 0)`.mapWith(
          Number,
        ),
        pendingCount: sql<number>`count(*) filter (where ${paymentRecords.status} = 'reported')`.mapWith(
          Number,
        ),
        pendingDeclaredCents: sql<number>`coalesce(sum(${paymentRecords.declaredAmountCents}) filter (where ${paymentRecords.status} = 'reported'), 0)`.mapWith(
          Number,
        ),
        unsettledZumraCents: sql<number>`coalesce(sum(${paymentRecords.zumraShareCents}) filter (where ${paymentRecords.status} = 'confirmed' and ${paymentRecords.settlementId} is null), 0)`.mapWith(
          Number,
        ),
      })
      .from(paymentRecords),
    database
      .select({
        overdueCents: sql<number>`coalesce(sum(${enrollmentInstallments.amountCents} - ${enrollmentInstallments.paidCents}), 0)`.mapWith(
          Number,
        ),
        overdueCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(enrollmentInstallments)
      .innerJoin(
        enrollments,
        eq(enrollments.id, enrollmentInstallments.enrollmentId),
      )
      .where(
        and(
          lt(enrollmentInstallments.dueDate, today),
          inArray(enrollmentInstallments.status, ['pending', 'partial']),
          inArray(enrollments.status, ['active', 'paused']),
        ),
      ),
  ]);

  return {
    monthConfirmedCents: paymentTotals[0]?.monthConfirmedCents ?? 0,
    overdueCents: overdue[0]?.overdueCents ?? 0,
    overdueCount: overdue[0]?.overdueCount ?? 0,
    pendingCount: paymentTotals[0]?.pendingCount ?? 0,
    pendingDeclaredCents: paymentTotals[0]?.pendingDeclaredCents ?? 0,
    unsettledZumraCents: paymentTotals[0]?.unsettledZumraCents ?? 0,
  };
}

/* ------------------------------------------------------------------------- */
/* Installment plans                                                          */
/* ------------------------------------------------------------------------- */

export async function listEnrollmentInstallments(
  principal: WorkspacePrincipal,
  enrollmentId: string,
): Promise<InstallmentView[]> {
  await assertStaffCanAccessEnrollment(principal, enrollmentId);

  const rows = await database
    .select({
      amountCents: enrollmentInstallments.amountCents,
      dueDate: enrollmentInstallments.dueDate,
      id: enrollmentInstallments.id,
      label: enrollmentInstallments.label,
      note: enrollmentInstallments.note,
      paidCents: enrollmentInstallments.paidCents,
      sequence: enrollmentInstallments.sequence,
      status: enrollmentInstallments.status,
    })
    .from(enrollmentInstallments)
    .where(eq(enrollmentInstallments.enrollmentId, enrollmentId))
    .orderBy(enrollmentInstallments.sequence);

  return rows;
}

// Replaces the plan wholesale. Rows that already collected money are locked:
// they must stay, and their amount can only grow up to what is already paid.
export async function saveEnrollmentInstallmentPlan(
  principal: WorkspacePrincipal,
  enrollmentId: string,
  plan: Array<{
    amountCents: number;
    dueDate: string;
    id?: string;
    label?: string;
    note?: string;
  }>,
) {
  await assertStaffCanAccessEnrollment(principal, enrollmentId);

  if (!plan.length || plan.length > 60) {
    throw new PublicFlowError('invalid_installment_plan', 400);
  }

  for (const row of plan) {
    if (
      !Number.isInteger(row.amountCents) ||
      row.amountCents <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)
    ) {
      throw new PublicFlowError('invalid_installment_plan', 400);
    }
  }

  await database.transaction(async (transaction) => {
    const existing = await transaction
      .select({
        id: enrollmentInstallments.id,
        paidCents: enrollmentInstallments.paidCents,
      })
      .from(enrollmentInstallments)
      .where(eq(enrollmentInstallments.enrollmentId, enrollmentId))
      .for('update');

    const existingById = new Map(existing.map((row) => [row.id, row]));
    const keptIds = new Set(
      plan
        .map((row) => row.id)
        .filter((value): value is string => Boolean(value)),
    );

    for (const id of keptIds) {
      if (!existingById.has(id)) {
        throw new PublicFlowError('installment_not_found', 404);
      }
    }

    const removed = existing.filter((row) => !keptIds.has(row.id));

    if (removed.some((row) => row.paidCents > 0)) {
      throw new PublicFlowError('installment_has_payments', 409);
    }

    if (removed.length) {
      const [linked] = await transaction
        .select({ id: paymentRecords.id })
        .from(paymentRecords)
        .where(
          inArray(
            paymentRecords.installmentId,
            removed.map((row) => row.id),
          ),
        )
        .limit(1);

      if (linked) {
        throw new PublicFlowError('installment_has_payments', 409);
      }

      await transaction.delete(enrollmentInstallments).where(
        inArray(
          enrollmentInstallments.id,
          removed.map((row) => row.id),
        ),
      );
    }

    // Two passes so renumbering never trips the (enrollment, sequence) unique
    // constraint mid-update. The parking offset stays positive because the
    // sequence >= 1 check fires per row; 1000+ cannot collide with real
    // sequences (plan length is capped at 60).
    for (const [index, row] of plan.entries()) {
      if (row.id) {
        await transaction
          .update(enrollmentInstallments)
          .set({ sequence: 1000 + index + 1 })
          .where(eq(enrollmentInstallments.id, row.id));
      }
    }

    for (const [index, row] of plan.entries()) {
      const sequence = index + 1;

      if (row.id) {
        const current = existingById.get(row.id);

        if (current && row.amountCents < current.paidCents) {
          throw new PublicFlowError('installment_below_paid', 409);
        }

        await transaction
          .update(enrollmentInstallments)
          .set({
            amountCents: row.amountCents,
            dueDate: row.dueDate,
            label: row.label?.trim() || null,
            note: row.note?.trim() || null,
            sequence,
            status:
              current && current.paidCents >= row.amountCents
                ? 'paid'
                : current && current.paidCents > 0
                  ? 'partial'
                  : 'pending',
            updatedAt: new Date(),
          })
          .where(eq(enrollmentInstallments.id, row.id));
      } else {
        await transaction.insert(enrollmentInstallments).values({
          amountCents: row.amountCents,
          createdByUserId: principal.id,
          dueDate: row.dueDate,
          enrollmentId,
          label: row.label?.trim() || null,
          note: row.note?.trim() || null,
          sequence,
        });
      }
    }
  });

  return listEnrollmentInstallments(principal, enrollmentId);
}

// Called from completeEnrollment: seeds the agreed plan from the wizard's
// financial step (down payment now, the rest split monthly). Staff can reshape
// it afterwards from the payments screens.
export async function generateDefaultInstallmentPlan(
  transaction: TransactionClient,
  input: {
    createdByUserId: string;
    enrolledAt: Date;
    enrollmentId: string;
    finalPriceCents: number;
    initialPaymentCents: number;
    installmentCount: number;
  },
) {
  const rows: Array<{
    amountCents: number;
    createdByUserId: string;
    dueDate: string;
    enrollmentId: string;
    label: string | null;
    sequence: number;
  }> = [];
  // Calendar arithmetic with day clamping (Jan 31 + 1 month → Feb 28, not
  // Mar 3) on local components — toISOString would shift the date for
  // enrollments completed between 00:00 and 03:00 Istanbul time.
  const dueDate = (offsetMonths: number) => {
    const base = input.enrolledAt;
    const target = new Date(
      base.getFullYear(),
      base.getMonth() + offsetMonths,
      1,
    );
    const daysInTarget = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      0,
    ).getDate();
    target.setDate(Math.min(base.getDate(), daysInTarget));
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${target.getFullYear()}-${month}-${day}`;
  };

  let sequence = 1;

  if (input.initialPaymentCents > 0) {
    rows.push({
      amountCents: input.initialPaymentCents,
      createdByUserId: input.createdByUserId,
      dueDate: dueDate(0),
      enrollmentId: input.enrollmentId,
      label: 'Peşinat',
      sequence: sequence++,
    });
  }

  const remainder = input.finalPriceCents - input.initialPaymentCents;
  const count = Math.max(1, input.installmentCount);

  if (remainder > 0) {
    const base = Math.floor(remainder / count);
    let allocated = 0;

    for (let index = 0; index < count; index += 1) {
      const amountCents =
        index === count - 1 ? remainder - allocated : base;
      allocated += amountCents;

      if (amountCents > 0) {
        rows.push({
          amountCents,
          createdByUserId: input.createdByUserId,
          dueDate: dueDate(index + (input.initialPaymentCents > 0 ? 1 : 0)),
          enrollmentId: input.enrollmentId,
          label: null,
          sequence: sequence++,
        });
      }
    }
  }

  if (rows.length) {
    await transaction.insert(enrollmentInstallments).values(rows);
  }
}

/* ------------------------------------------------------------------------- */
/* Commission rates                                                           */
/* ------------------------------------------------------------------------- */

export async function getCommissionCatalog(principal: WorkspacePrincipal) {
  assertAdmin(principal);

  const [branches, privateInstructors, rates] = await Promise.all([
    database
      .select({
        branchName: programBranches.name,
        id: programBranches.id,
        instructorFirstName: instructorProfiles.firstName,
        instructorLastName: instructorProfiles.lastName,
        language: programs.language,
        programName: programs.name,
        status: programBranches.status,
      })
      .from(programBranches)
      .innerJoin(programs, eq(programs.id, programBranches.programId))
      .leftJoin(
        instructorProfiles,
        eq(instructorProfiles.id, programBranches.instructorProfileId),
      )
      .where(isNull(programBranches.archivedAt))
      .orderBy(programs.name, programBranches.name),
    database
      .selectDistinct({
        firstName: instructorProfiles.firstName,
        id: instructorProfiles.id,
        lastName: instructorProfiles.lastName,
      })
      .from(privateLessonStudentRates)
      .innerJoin(
        instructorProfiles,
        eq(instructorProfiles.id, privateLessonStudentRates.instructorProfileId),
      )
      .where(eq(privateLessonStudentRates.active, true))
      .orderBy(instructorProfiles.lastName, instructorProfiles.firstName),
    database
      .select({
        branchId: commissionRates.branchId,
        instructorId: commissionRates.instructorId,
        note: commissionRates.note,
        scope: commissionRates.scope,
        teacherShareBasisPoints: commissionRates.teacherShareBasisPoints,
      })
      .from(commissionRates),
  ]);

  const branchRates = new Map(
    rates
      .filter((rate) => rate.scope === 'branch' && rate.branchId)
      .map((rate) => [rate.branchId as string, rate]),
  );
  const instructorRates = new Map(
    rates
      .filter(
        (rate) => rate.scope === 'instructor_private' && rate.instructorId,
      )
      .map((rate) => [rate.instructorId as string, rate]),
  );

  return {
    branches: branches.map((branch) => ({
      id: branch.id,
      instructorName:
        `${branch.instructorFirstName ?? ''} ${branch.instructorLastName ?? ''}`.trim() ||
        null,
      label: `${branch.programName} — ${branch.branchName}`,
      language: branch.language,
      note: branchRates.get(branch.id)?.note ?? null,
      status: branch.status,
      teacherShareBasisPoints:
        branchRates.get(branch.id)?.teacherShareBasisPoints ?? null,
    })),
    privateInstructors: privateInstructors.map((instructor) => ({
      id: instructor.id,
      name: `${instructor.firstName} ${instructor.lastName}`.trim(),
      note: instructorRates.get(instructor.id)?.note ?? null,
      teacherShareBasisPoints:
        instructorRates.get(instructor.id)?.teacherShareBasisPoints ?? null,
    })),
  };
}

export async function setCommissionRate(
  principal: WorkspacePrincipal,
  input: {
    branchId?: string;
    instructorId?: string;
    note?: string;
    scope: 'branch' | 'instructor_private';
    teacherShareBasisPoints: number;
  },
) {
  assertAdmin(principal);

  if (
    !Number.isInteger(input.teacherShareBasisPoints) ||
    input.teacherShareBasisPoints < 0 ||
    input.teacherShareBasisPoints > 10_000
  ) {
    throw new PublicFlowError('invalid_commission_rate', 400);
  }

  if (
    (input.scope === 'branch') !== Boolean(input.branchId) ||
    (input.scope === 'instructor_private') !== Boolean(input.instructorId)
  ) {
    throw new PublicFlowError('invalid_commission_scope', 400);
  }

  const now = new Date();
  const target =
    input.scope === 'branch'
      ? commissionRates.branchId
      : commissionRates.instructorId;

  await database
    .insert(commissionRates)
    .values({
      branchId: input.branchId ?? null,
      instructorId: input.instructorId ?? null,
      note: input.note?.trim() || null,
      scope: input.scope,
      teacherShareBasisPoints: input.teacherShareBasisPoints,
      updatedByUserId: principal.id,
    })
    .onConflictDoUpdate({
      set: {
        note: input.note?.trim() || null,
        teacherShareBasisPoints: input.teacherShareBasisPoints,
        updatedAt: now,
        updatedByUserId: principal.id,
      },
      target,
      targetWhere:
        input.scope === 'branch'
          ? sql`scope = 'branch'`
          : sql`scope = 'instructor_private'`,
    });

  return getCommissionCatalog(principal);
}

/* ------------------------------------------------------------------------- */
/* Settlements (öğretmen ödemesi al)                                          */
/* ------------------------------------------------------------------------- */

export async function getSettlementWorkspace(principal: WorkspacePrincipal) {
  assertAdmin(principal);

  const instructors = await database
    .select({
      firstName: instructorProfiles.firstName,
      id: instructorProfiles.id,
      lastName: instructorProfiles.lastName,
      unsettledCents:
        sql<number>`coalesce(sum(${paymentRecords.zumraShareCents}), 0)`.mapWith(
          Number,
        ),
      unsettledCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(paymentRecords)
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, paymentRecords.instructorId),
    )
    .where(
      and(
        eq(paymentRecords.status, 'confirmed'),
        isNull(paymentRecords.settlementId),
      ),
    )
    .groupBy(
      instructorProfiles.id,
      instructorProfiles.firstName,
      instructorProfiles.lastName,
    )
    .orderBy(instructorProfiles.lastName);

  return {
    instructors: instructors.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`.trim(),
      unsettledCents: row.unsettledCents,
      unsettledCount: row.unsettledCount,
    })),
  };
}

export async function listUnsettledPayments(
  principal: WorkspacePrincipal,
  instructorId: string,
) {
  assertAdmin(principal);

  const rows = await paymentListQuery(database)
    .where(
      and(
        eq(paymentRecords.instructorId, instructorId),
        eq(paymentRecords.status, 'confirmed'),
        isNull(paymentRecords.settlementId),
      ),
    )
    .orderBy(desc(paymentRecords.reviewedAt))
    .limit(500);

  return rows.map(toPaymentView);
}

export async function recordTeacherSettlement(
  principal: WorkspacePrincipal,
  input: { instructorId: string; note?: string; paymentIds: string[] },
) {
  assertAdmin(principal);

  if (!input.paymentIds.length || input.paymentIds.length > 500) {
    throw new PublicFlowError('invalid_settlement_selection', 400);
  }

  const result = await database.transaction(async (transaction) => {
    const selected = await transaction
      .select({
        id: paymentRecords.id,
        instructorId: paymentRecords.instructorId,
        settlementId: paymentRecords.settlementId,
        status: paymentRecords.status,
        zumraShareCents: paymentRecords.zumraShareCents,
      })
      .from(paymentRecords)
      .where(inArray(paymentRecords.id, input.paymentIds))
      .for('update');

    if (selected.length !== input.paymentIds.length) {
      throw new PublicFlowError('payment_not_found', 404);
    }

    for (const record of selected) {
      if (
        record.instructorId !== input.instructorId ||
        record.status !== 'confirmed' ||
        record.settlementId !== null
      ) {
        throw new PublicFlowError('invalid_settlement_selection', 409);
      }
    }

    const totalCents = selected.reduce(
      (sum, record) => sum + (record.zumraShareCents ?? 0),
      0,
    );

    const [settlement] = await transaction
      .insert(teacherSettlements)
      .values({
        instructorId: input.instructorId,
        note: input.note?.trim() || null,
        receivedByUserId: principal.id,
        totalCents,
      })
      .returning({ id: teacherSettlements.id });

    await transaction
      .update(paymentRecords)
      .set({ settlementId: settlement.id, updatedAt: new Date() })
      .where(inArray(paymentRecords.id, input.paymentIds));

    return { settlementId: settlement.id, totalCents };
  });

  await notifySettlementRecorded({
    instructorId: input.instructorId,
    settlementId: result.settlementId,
    totalCents: result.totalCents,
  });

  return result;
}

/* ------------------------------------------------------------------------- */
/* Bank accounts                                                              */
/* ------------------------------------------------------------------------- */

export async function setInstructorBankAccount(
  principal: WorkspacePrincipal,
  input: { holderName?: string; iban: string; instructorId: string },
) {
  assertAdmin(principal);

  const protectedIban = protectIban(input.iban);
  const now = new Date();

  await database.transaction(async (transaction) => {
    const [instructor] = await transaction
      .select({ id: instructorProfiles.id })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.id, input.instructorId))
      .limit(1);

    if (!instructor) {
      throw new PublicFlowError('instructor_not_found', 404);
    }

    await transaction
      .update(instructorBankAccounts)
      .set({ archivedAt: now })
      .where(
        and(
          eq(instructorBankAccounts.instructorId, input.instructorId),
          isNull(instructorBankAccounts.archivedAt),
        ),
      );

    await transaction.insert(instructorBankAccounts).values({
      createdByUserId: principal.id,
      holderName: input.holderName?.trim() || null,
      ibanBlindIndex: protectedIban.blindIndex,
      ibanEncrypted: protectedIban.encrypted,
      ibanLastFour: protectedIban.lastFour,
      instructorId: input.instructorId,
    });
  });

  return { lastFour: protectedIban.lastFour };
}

export async function listInstructorBankAccounts(
  principal: WorkspacePrincipal,
  instructorId: string,
) {
  assertAdmin(principal);

  const rows = await database
    .select({
      archivedAt: instructorBankAccounts.archivedAt,
      createdAt: instructorBankAccounts.createdAt,
      holderName: instructorBankAccounts.holderName,
      ibanEncrypted: instructorBankAccounts.ibanEncrypted,
      id: instructorBankAccounts.id,
    })
    .from(instructorBankAccounts)
    .where(eq(instructorBankAccounts.instructorId, instructorId))
    .orderBy(desc(instructorBankAccounts.createdAt));

  return rows.map((row) => ({
    active: row.archivedAt === null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    holderName: row.holderName,
    iban: formatIban(decryptIban(row.ibanEncrypted)),
    id: row.id,
  }));
}

/* ------------------------------------------------------------------------- */
/* CSV export                                                                 */
/* ------------------------------------------------------------------------- */

const CSV_HEADERS = [
  'Öğrenci',
  'Kurs',
  'Taksit',
  'Eğitmen',
  'Durum',
  'Beyan (TL)',
  'Tutar (TL)',
  'Zümra Payı (TL)',
  'Bildirim Tarihi',
  'Onay Tarihi',
  'Mutabakat',
];

function csvCell(value: string) {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function centsToLira(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

// The accounting export must not silently stop at the UI page size; 50k rows
// is far beyond any realistic ledger for this school.
const EXPORT_LIMIT = 50_000;

export async function exportPaymentsCsv(
  principal: WorkspacePrincipal,
  filters: Parameters<typeof listStaffPayments>[1] = {},
) {
  const rows = await listStaffPayments(principal, filters, EXPORT_LIMIT);
  const statusLabels: Record<PaymentRecordView['status'], string> = {
    confirmed: 'Onaylandı',
    rejected: 'Reddedildi',
    reported: 'Onay bekliyor',
  };

  const lines = [
    CSV_HEADERS.join(';'),
    ...rows.map((row) =>
      [
        row.studentName,
        row.courseLabel,
        row.installmentLabel ?? '',
        row.instructorName,
        statusLabels[row.status],
        centsToLira(row.declaredAmountCents),
        centsToLira(row.amountCents),
        centsToLira(row.zumraShareCents),
        isoToIstanbulWallClock(row.reportedAt).slice(0, 10),
        row.reviewedAt ? isoToIstanbulWallClock(row.reviewedAt).slice(0, 10) : '',
        row.settled ? 'Kapatıldı' : 'Açık',
      ]
        .map(csvCell)
        .join(';'),
    ),
  ];

  // BOM so Excel detects UTF-8; semicolons match the TR locale list separator.
  return `﻿${lines.join('\r\n')}`;
}
