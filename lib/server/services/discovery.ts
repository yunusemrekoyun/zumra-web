import 'server-only';

import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  candidateProfiles,
  contacts,
  discoveryFees,
  discoveryLessons,
  instructorBankAccounts,
  instructorProfiles,
  programBranches,
  studentAccountInvitations,
  studentProfiles,
  userInvitations,
  users,
} from '@/lib/server/db/schema';
import { getAuthEnv } from '@/lib/server/env';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { decryptIban } from '@/lib/server/security/bank-account';
import { createOpaqueToken } from '@/lib/server/security/tokens';
import { assertValidUsername } from '@/lib/server/security/username';
import { notificationService } from './notifications';

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
// Panel access for a trial account survives this long past the lesson.
const DEMO_ACCESS_AFTER_LESSON_MS = 7 * 24 * 60 * 60 * 1000;

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function formatIbanGroups(iban: string) {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

// ---------------------------------------------------------------------------
// Fee configuration (admin): per branch or per instructor; 0 = free. An
// instructor-specific fee wins over the branch fee; unconfigured = free.
// ---------------------------------------------------------------------------

export type DiscoveryFeeView = {
  active: boolean;
  feeCents: number;
  id: string;
  scope: 'branch' | 'instructor';
  targetId: string;
  targetName: string;
};

export async function listDiscoveryFees(
  principal: WorkspacePrincipal,
): Promise<DiscoveryFeeView[]> {
  assertAdmin(principal);

  const rows = await database
    .select({
      active: discoveryFees.active,
      branchId: discoveryFees.branchId,
      branchName: programBranches.name,
      feeCents: discoveryFees.feeCents,
      id: discoveryFees.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      instructorProfileId: discoveryFees.instructorProfileId,
      scope: discoveryFees.scope,
    })
    .from(discoveryFees)
    .leftJoin(programBranches, eq(programBranches.id, discoveryFees.branchId))
    .leftJoin(
      instructorProfiles,
      eq(instructorProfiles.id, discoveryFees.instructorProfileId),
    )
    .where(eq(discoveryFees.active, true))
    .orderBy(asc(discoveryFees.scope), desc(discoveryFees.updatedAt));

  return rows.map((row) => ({
    active: row.active,
    feeCents: row.feeCents,
    id: row.id,
    scope: row.scope,
    targetId: (row.scope === 'branch'
      ? row.branchId
      : row.instructorProfileId) as string,
    targetName:
      row.scope === 'branch'
        ? (row.branchName ?? '—')
        : fullName(row.instructorFirstName ?? '', row.instructorLastName ?? ''),
  }));
}

export async function setDiscoveryFee(
  principal: WorkspacePrincipal,
  input: {
    branchId?: string | null;
    feeCents: number;
    instructorProfileId?: string | null;
    scope: 'branch' | 'instructor';
  },
) {
  assertAdmin(principal);

  if (
    !Number.isInteger(input.feeCents) ||
    input.feeCents < 0 ||
    input.feeCents > 100_000_000
  ) {
    throw new PublicFlowError('invalid_fee', 400);
  }
  const targetId =
    input.scope === 'branch' ? input.branchId : input.instructorProfileId;
  if (!targetId) {
    throw new PublicFlowError('invalid_fee_target', 400);
  }

  return database.transaction(async (transaction) => {
    // Replace-in-place: retire any active row for the same target first.
    await transaction
      .update(discoveryFees)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(discoveryFees.scope, input.scope),
          eq(discoveryFees.active, true),
          input.scope === 'branch'
            ? eq(discoveryFees.branchId, targetId)
            : eq(discoveryFees.instructorProfileId, targetId),
        ),
      );

    const [created] = await transaction
      .insert(discoveryFees)
      .values({
        branchId: input.scope === 'branch' ? targetId : null,
        createdByUserId: principal.id,
        feeCents: input.feeCents,
        instructorProfileId:
          input.scope === 'instructor' ? targetId : null,
        scope: input.scope,
      })
      .returning({ id: discoveryFees.id });

    return { id: created.id };
  });
}

async function resolveDiscoveryFee(input: {
  branchId?: string | null;
  instructorProfileId: string;
}): Promise<number> {
  const [instructorFee] = await database
    .select({ feeCents: discoveryFees.feeCents })
    .from(discoveryFees)
    .where(
      and(
        eq(discoveryFees.scope, 'instructor'),
        eq(discoveryFees.instructorProfileId, input.instructorProfileId),
        eq(discoveryFees.active, true),
      ),
    )
    .limit(1);
  if (instructorFee) return instructorFee.feeCents;

  if (input.branchId) {
    const [branchFee] = await database
      .select({ feeCents: discoveryFees.feeCents })
      .from(discoveryFees)
      .where(
        and(
          eq(discoveryFees.scope, 'branch'),
          eq(discoveryFees.branchId, input.branchId),
          eq(discoveryFees.active, true),
        ),
      )
      .limit(1);
    if (branchFee) return branchFee.feeCents;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Scheduling + lifecycle
// ---------------------------------------------------------------------------

export type DiscoveryLessonView = {
  candidateId: string;
  candidateName: string;
  demoAccount: 'none' | 'invited' | 'active';
  feeCents: number;
  id: string;
  instructorName: string;
  note: string | null;
  paymentStatus: 'free' | 'awaiting' | 'reported' | 'received';
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
};

export async function scheduleDiscoveryLesson(
  principal: WorkspacePrincipal,
  input: {
    branchId?: string | null;
    candidateId: string;
    createAccount?: { username: string } | null;
    durationMinutes?: number;
    instructorProfileId: string;
    locale: 'tr' | 'en';
    note?: string | null;
    scheduledAt: string;
  },
) {
  assertStaff(principal);

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    throw new PublicFlowError('invalid_discovery_time', 400);
  }
  const durationMinutes = input.durationMinutes ?? 30;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 180
  ) {
    throw new PublicFlowError('invalid_discovery_time', 400);
  }

  const [candidate] = await database
    .select({
      contactId: candidateProfiles.contactId,
      email: contacts.email,
      firstName: contacts.firstName,
      id: candidateProfiles.id,
      lastName: contacts.lastName,
    })
    .from(candidateProfiles)
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .where(eq(candidateProfiles.id, input.candidateId))
    .limit(1);
  if (!candidate) throw new PublicFlowError('candidate_not_found', 404);

  const [instructor] = await database
    .select({
      email: instructorProfiles.email,
      firstName: instructorProfiles.firstName,
      id: instructorProfiles.id,
      lastName: instructorProfiles.lastName,
    })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.id, input.instructorProfileId))
    .limit(1);
  if (!instructor) throw new PublicFlowError('instructor_not_found', 404);

  const feeCents = await resolveDiscoveryFee({
    branchId: input.branchId,
    instructorProfileId: input.instructorProfileId,
  });

  const note = input.note?.trim().slice(0, 500) || null;

  const result = await database.transaction(async (transaction) => {
    const [lesson] = await transaction
      .insert(discoveryLessons)
      .values({
        branchId: input.branchId ?? null,
        candidateId: candidate.id,
        createdByUserId: principal.id,
        durationMinutes,
        feeCents,
        instructorProfileId: instructor.id,
        note,
        paymentStatus: feeCents > 0 ? 'awaiting' : 'free',
        scheduledAt,
      })
      .returning({ id: discoveryLessons.id });

    let invitation: {
      email: string;
      expiresAt: Date;
      id: string;
      token: string;
      username: string;
    } | null = null;

    if (input.createAccount) {
      const username = (() => {
        try {
          return assertValidUsername(input.createAccount.username);
        } catch {
          throw new PublicFlowError('invalid_username', 400);
        }
      })();
      const email = candidate.email.trim().toLocaleLowerCase('en-US');
      const demoExpiresAt = new Date(
        scheduledAt.getTime() + DEMO_ACCESS_AFTER_LESSON_MS,
      );

      const [existingProfile] = await transaction
        .select({ id: studentProfiles.id, userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(eq(studentProfiles.candidateId, candidate.id))
        .limit(1)
        .for('update');

      if (existingProfile?.userId) {
        throw new PublicFlowError('account_already_exists', 409);
      }

      const studentId =
        existingProfile?.id ??
        (
          await transaction
            .insert(studentProfiles)
            .values({
              candidateId: candidate.id,
              contactId: candidate.contactId,
              demoExpiresAt,
            })
            .returning({ id: studentProfiles.id })
        )[0].id;

      if (existingProfile) {
        await transaction
          .update(studentProfiles)
          .set({ demoExpiresAt, updatedAt: new Date() })
          .where(eq(studentProfiles.id, studentId));
      }

      const [duplicateEmail] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (duplicateEmail) {
        throw new PublicFlowError('invitation_email_already_registered', 409);
      }
      const [duplicateUsername] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      if (duplicateUsername) {
        throw new PublicFlowError('invitation_username_taken', 409);
      }

      const now = new Date();
      const [pendingInvitation] = await transaction
        .select({ id: userInvitations.id })
        .from(studentAccountInvitations)
        .innerJoin(
          userInvitations,
          eq(userInvitations.id, studentAccountInvitations.invitationId),
        )
        .where(
          and(
            eq(studentAccountInvitations.studentId, studentId),
            eq(userInvitations.status, 'pending'),
            gt(userInvitations.expiresAt, now),
          ),
        )
        .limit(1);
      if (pendingInvitation) {
        throw new PublicFlowError('invitation_already_pending', 409);
      }

      const { hash, token } = createOpaqueToken();
      const [created] = await transaction
        .insert(userInvitations)
        .values({
          email,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          invitedByUserId: principal.id,
          name: fullName(candidate.firstName, candidate.lastName),
          role: 'student',
          tokenHash: hash,
          username,
        })
        .returning({
          email: userInvitations.email,
          expiresAt: userInvitations.expiresAt,
          id: userInvitations.id,
          username: userInvitations.username,
        });

      await transaction.insert(studentAccountInvitations).values({
        invitationId: created.id,
        studentId,
      });

      invitation = { ...created, token };
    }

    return { invitation, lessonId: lesson.id };
  });

  // Post-commit fan-out: activation mail to the candidate (when an account was
  // opened) and a heads-up mail to the instructor. Failures must not undo the
  // recorded lesson.
  try {
    if (result.invitation) {
      const activationUrl = new URL(
        `/${input.locale}/aktivasyon`,
        getAuthEnv().APP_URL,
      );
      activationUrl.searchParams.set('token', result.invitation.token);
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `invitation:${result.invitation.id}`,
        locale: input.locale,
        payload: {
          expiresAt: result.invitation.expiresAt.toISOString(),
          name: fullName(candidate.firstName, candidate.lastName),
          username: result.invitation.username,
        },
        recipient: result.invitation.email,
        sensitivePayload: { activationUrl: activationUrl.toString() },
        templateKey: 'account-invitation',
      });
    }

    if (instructor.email) {
      await notificationService.enqueue({
        channel: 'email',
        idempotencyKey: `discovery-scheduled:${result.lessonId}:${instructor.email}`,
        locale: 'tr',
        payload: {
          candidateName: fullName(candidate.firstName, candidate.lastName),
          lessonDate: scheduledAt.toISOString(),
          note: note ?? '',
        },
        recipient: instructor.email,
        templateKey: 'discovery-lesson-scheduled',
      });
    }
  } catch {
    // best-effort
  }

  return { id: result.lessonId };
}

export async function listDiscoveryLessons(
  principal: WorkspacePrincipal,
): Promise<DiscoveryLessonView[]> {
  assertStaff(principal);

  const rows = await database
    .select({
      candidateId: discoveryLessons.candidateId,
      feeCents: discoveryLessons.feeCents,
      firstName: contacts.firstName,
      id: discoveryLessons.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      lastName: contacts.lastName,
      note: discoveryLessons.note,
      paymentStatus: discoveryLessons.paymentStatus,
      scheduledAt: discoveryLessons.scheduledAt,
      status: discoveryLessons.status,
      studentProfileId: studentProfiles.id,
      studentUserId: studentProfiles.userId,
    })
    .from(discoveryLessons)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, discoveryLessons.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, discoveryLessons.instructorProfileId),
    )
    .leftJoin(
      studentProfiles,
      eq(studentProfiles.candidateId, discoveryLessons.candidateId),
    )
    .orderBy(desc(discoveryLessons.scheduledAt))
    .limit(100);

  return rows.map((row) => ({
    candidateId: row.candidateId,
    candidateName: fullName(row.firstName, row.lastName),
    demoAccount: row.studentUserId
      ? 'active'
      : row.studentProfileId
        ? 'invited'
        : 'none',
    feeCents: row.feeCents,
    id: row.id,
    instructorName: fullName(row.instructorFirstName, row.instructorLastName),
    note: row.note,
    paymentStatus: row.paymentStatus,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
  }));
}

export async function updateDiscoveryLesson(
  principal: WorkspacePrincipal,
  lessonId: string,
  input: {
    paymentStatus?: 'received';
    status?: 'completed' | 'cancelled' | 'no_show';
  },
) {
  assertStaff(principal);
  if (!input.status && !input.paymentStatus) {
    throw new PublicFlowError('invalid_request', 400);
  }

  const [lesson] = await database
    .select({
      feeCents: discoveryLessons.feeCents,
      id: discoveryLessons.id,
      paymentStatus: discoveryLessons.paymentStatus,
    })
    .from(discoveryLessons)
    .where(eq(discoveryLessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new PublicFlowError('discovery_lesson_not_found', 404);

  if (input.paymentStatus === 'received' && lesson.feeCents === 0) {
    throw new PublicFlowError('discovery_lesson_free', 409);
  }

  await database
    .update(discoveryLessons)
    .set({
      ...(input.status ? { status: input.status } : {}),
      ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
      updatedAt: new Date(),
    })
    .where(eq(discoveryLessons.id, lessonId));

  return { id: lessonId };
}

// ---------------------------------------------------------------------------
// Demo user's own view (student panel)
// ---------------------------------------------------------------------------

export type MyDiscoveryLessonView = {
  canReportPayment: boolean;
  feeCents: number;
  iban: string | null;
  ibanHolder: string | null;
  id: string;
  instructorName: string;
  paymentStatus: 'free' | 'awaiting' | 'reported' | 'received';
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
};

export async function getMyDiscoveryLessons(
  principal: WorkspacePrincipal,
): Promise<MyDiscoveryLessonView[]> {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const [profile] = await database
    .select({ candidateId: studentProfiles.candidateId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);
  if (!profile) return [];

  const rows = await database
    .select({
      feeCents: discoveryLessons.feeCents,
      id: discoveryLessons.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      instructorProfileId: discoveryLessons.instructorProfileId,
      paymentStatus: discoveryLessons.paymentStatus,
      scheduledAt: discoveryLessons.scheduledAt,
      status: discoveryLessons.status,
    })
    .from(discoveryLessons)
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, discoveryLessons.instructorProfileId),
    )
    .where(eq(discoveryLessons.candidateId, profile.candidateId))
    .orderBy(desc(discoveryLessons.scheduledAt))
    .limit(10);

  const unpaidInstructorIds = Array.from(
    new Set(
      rows
        .filter(
          (row) =>
            row.feeCents > 0 &&
            (row.paymentStatus === 'awaiting' ||
              row.paymentStatus === 'reported'),
        )
        .map((row) => row.instructorProfileId),
    ),
  );
  const bankRows = unpaidInstructorIds.length
    ? await database
        .select({
          holderName: instructorBankAccounts.holderName,
          ibanEncrypted: instructorBankAccounts.ibanEncrypted,
          instructorId: instructorBankAccounts.instructorId,
        })
        .from(instructorBankAccounts)
        .where(
          and(
            inArray(
              instructorBankAccounts.instructorId,
              unpaidInstructorIds,
            ),
            isNull(instructorBankAccounts.archivedAt),
          ),
        )
    : [];
  const bankByInstructor = new Map(
    bankRows.map((row) => [
      row.instructorId,
      {
        holderName: row.holderName,
        iban: formatIbanGroups(decryptIban(row.ibanEncrypted)),
      },
    ]),
  );

  return rows.map((row) => {
    const showBank =
      row.feeCents > 0 &&
      (row.paymentStatus === 'awaiting' || row.paymentStatus === 'reported');
    const bank = showBank
      ? bankByInstructor.get(row.instructorProfileId)
      : undefined;
    return {
      canReportPayment:
        row.paymentStatus === 'awaiting' && row.status === 'scheduled',
      feeCents: row.feeCents,
      iban: bank?.iban ?? null,
      ibanHolder: bank?.holderName ?? null,
      id: row.id,
      instructorName: fullName(
        row.instructorFirstName,
        row.instructorLastName,
      ),
      paymentStatus: row.paymentStatus,
      scheduledAt: row.scheduledAt.toISOString(),
      status: row.status,
    };
  });
}

export async function reportDiscoveryPayment(
  principal: WorkspacePrincipal,
  lessonId: string,
) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const [profile] = await database
    .select({ candidateId: studentProfiles.candidateId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);
  if (!profile) throw new PublicFlowError('student_profile_not_found', 404);

  const [updated] = await database
    .update(discoveryLessons)
    .set({ paymentStatus: 'reported', updatedAt: new Date() })
    .where(
      and(
        eq(discoveryLessons.id, lessonId),
        eq(discoveryLessons.candidateId, profile.candidateId),
        eq(discoveryLessons.paymentStatus, 'awaiting'),
      ),
    )
    .returning({ id: discoveryLessons.id });

  if (!updated) {
    throw new PublicFlowError('discovery_lesson_not_open', 409);
  }

  return { id: lessonId };
}

// ---------------------------------------------------------------------------
// Teacher calendar feed + demo access check
// ---------------------------------------------------------------------------

export type InstructorDiscoveryLesson = {
  candidateName: string;
  durationMinutes: number;
  id: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
};

export async function listInstructorDiscoveryLessons(
  instructorProfileId: string,
): Promise<InstructorDiscoveryLesson[]> {
  const rows = await database
    .select({
      durationMinutes: discoveryLessons.durationMinutes,
      firstName: contacts.firstName,
      id: discoveryLessons.id,
      lastName: contacts.lastName,
      scheduledAt: discoveryLessons.scheduledAt,
      status: discoveryLessons.status,
    })
    .from(discoveryLessons)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, discoveryLessons.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .where(eq(discoveryLessons.instructorProfileId, instructorProfileId))
    .orderBy(desc(discoveryLessons.scheduledAt))
    .limit(60);

  return rows.map((row) => ({
    candidateName: fullName(row.firstName, row.lastName),
    durationMinutes: row.durationMinutes,
    id: row.id,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
  }));
}

// Picker data for the scheduling form.
export type DiscoverySchedulingOptions = {
  branches: Array<{ id: string; name: string }>;
  candidates: Array<{ id: string; name: string }>;
  instructors: Array<{ id: string; name: string }>;
};

export async function getDiscoverySchedulingOptions(
  principal: WorkspacePrincipal,
): Promise<DiscoverySchedulingOptions> {
  assertStaff(principal);

  const [candidateRows, instructorRows, branchRows] = await Promise.all([
    database
      .select({
        firstName: contacts.firstName,
        id: candidateProfiles.id,
        lastName: contacts.lastName,
      })
      .from(candidateProfiles)
      .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
      .where(inArray(candidateProfiles.stage, [
        'new',
        'contacted',
        'qualified',
        'offer_pending',
      ]))
      .orderBy(desc(candidateProfiles.lastActivityAt))
      .limit(200),
    database
      .select({
        firstName: instructorProfiles.firstName,
        id: instructorProfiles.id,
        lastName: instructorProfiles.lastName,
      })
      .from(instructorProfiles)
      .orderBy(asc(instructorProfiles.firstName)),
    database
      .select({ id: programBranches.id, name: programBranches.name })
      .from(programBranches)
      .where(isNull(programBranches.archivedAt))
      .orderBy(asc(programBranches.name)),
  ]);

  return {
    branches: branchRows,
    candidates: candidateRows.map((row) => ({
      id: row.id,
      name: fullName(row.firstName, row.lastName),
    })),
    instructors: instructorRows.map((row) => ({
      id: row.id,
      name: fullName(row.firstName, row.lastName),
    })),
  };
}

// Raw rows for the calendar feed (mapped into calendar events by the
// lesson-schedules service to avoid a type cycle).
export type DiscoveryCalendarRow = {
  candidateName: string;
  durationMinutes: number;
  id: string;
  instructorName: string;
  scheduledAt: Date;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
};

export async function listDiscoveryCalendarRows(
  instructorProfileId?: string,
): Promise<DiscoveryCalendarRow[]> {
  const rows = await database
    .select({
      durationMinutes: discoveryLessons.durationMinutes,
      firstName: contacts.firstName,
      id: discoveryLessons.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      lastName: contacts.lastName,
      scheduledAt: discoveryLessons.scheduledAt,
      status: discoveryLessons.status,
    })
    .from(discoveryLessons)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, discoveryLessons.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, discoveryLessons.instructorProfileId),
    )
    .where(
      instructorProfileId
        ? eq(discoveryLessons.instructorProfileId, instructorProfileId)
        : undefined,
    )
    .orderBy(desc(discoveryLessons.scheduledAt))
    .limit(200);

  return rows.map((row) => ({
    candidateName: fullName(row.firstName, row.lastName),
    durationMinutes: row.durationMinutes,
    id: row.id,
    instructorName: fullName(row.instructorFirstName, row.instructorLastName),
    scheduledAt: row.scheduledAt,
    status: row.status,
  }));
}
