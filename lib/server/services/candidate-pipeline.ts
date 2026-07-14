import 'server-only';

import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  advisorTasks,
  appointmentRequests,
  candidateActivities,
  candidateInquiries,
  candidateNotes,
  candidateProfiles,
  contacts,
  mediaAssets,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import {
  closeSystemTasks,
  spawnSystemTask,
} from '@/lib/server/services/advisor-tasks';
import { notificationService } from '@/lib/server/services/notifications';

export const candidateStages = [
  'new',
  'contacted',
  'qualified',
  'offer_pending',
  'enrolled',
  'lost',
] as const;
export type CandidateStage = (typeof candidateStages)[number];

export type AdvisorOption = { id: string; name: string; photoUrl: string | null };

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

async function requireCandidate(candidateId: string) {
  const [row] = await database
    .select({
      advisorId: candidateProfiles.advisorId,
      id: candidateProfiles.id,
      stage: candidateProfiles.stage,
    })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, candidateId))
    .limit(1);
  if (!row) throw new PublicFlowError('candidate_not_found', 404);
  return row;
}

// Only real advisors can OWN candidates; admins intervene in flows but are
// never assignable, so they are excluded from every assignment surface.
export async function listAdvisors(
  principal: WorkspacePrincipal,
): Promise<AdvisorOption[]> {
  assertStaff(principal);
  const rows = await database
    .select({
      id: users.id,
      name: users.name,
      photoAssetId: mediaAssets.id,
    })
    .from(users)
    .leftJoin(
      mediaAssets,
      and(
        eq(mediaAssets.id, users.photoMediaAssetId),
        eq(mediaAssets.status, 'ready'),
      ),
    )
    .where(eq(users.role, 'advisor'))
    .orderBy(asc(users.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    photoUrl: row.photoAssetId ? `/api/media/${row.photoAssetId}` : null,
  }));
}

export async function updateCandidateStage(
  principal: WorkspacePrincipal,
  candidateId: string,
  stage: CandidateStage,
  options: { closeOpenItems?: boolean } = {},
): Promise<void> {
  assertStaff(principal);
  if (!candidateStages.includes(stage)) {
    throw new PublicFlowError('invalid_request');
  }
  // 'Enrolled' is earned, not picked: only a completed enrollment wizard may
  // set it — a manual switch would fake a registration that doesn't exist.
  if (stage === 'enrolled') {
    throw new PublicFlowError('stage_requires_enrollment', 409);
  }
  const existing = await requireCandidate(candidateId);
  if (existing.stage === stage) return;
  const now = new Date();
  await database.transaction(async (tx) => {
    await tx
      .update(candidateProfiles)
      .set({ stage, lastActivityAt: now, updatedAt: now })
      .where(eq(candidateProfiles.id, candidateId));
    await tx.insert(candidateActivities).values({
      candidateId,
      type: 'candidate.stage_changed',
      metadata: { from: existing.stage, to: stage },
    });
    // Losing a lead can (with the user's confirmation) sweep its open work
    // items so no scheduled meeting or task lingers behind a dead deal.
    if (stage === 'lost' && options.closeOpenItems) {
      await tx
        .update(appointmentRequests)
        .set({
          outcomeNote: 'auto_closed_lost',
          status: 'cancelled',
          updatedAt: now,
        })
        .where(
          and(
            eq(appointmentRequests.candidateId, candidateId),
            inArray(appointmentRequests.status, ['requested', 'scheduled']),
          ),
        );
      await tx
        .update(advisorTasks)
        .set({
          completedAt: now,
          completedByUserId: principal.id,
          status: 'done',
          updatedAt: now,
        })
        .where(
          and(
            eq(advisorTasks.candidateId, candidateId),
            eq(advisorTasks.status, 'open'),
            ne(advisorTasks.kind, 'manual'),
          ),
        );
    }
  });
}

export async function assignCandidateAdvisor(
  principal: WorkspacePrincipal,
  candidateId: string,
  advisorId: string | null,
): Promise<void> {
  assertStaff(principal);
  if (advisorId) {
    const [advisor] = await database
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, advisorId), eq(users.role, 'advisor')))
      .limit(1);
    if (!advisor) throw new PublicFlowError('invalid_request');
  }
  const existing = await requireCandidate(candidateId);

  // Advisors may claim unowned candidates or release/keep their own, but
  // taking over (or reassigning) a colleague's candidate is an admin move —
  // otherwise the claim-task ownership guard could be sidestepped here.
  if (
    principal.role === 'advisor' &&
    existing.advisorId &&
    existing.advisorId !== principal.id
  ) {
    throw new PublicFlowError('candidate_owned', 409);
  }

  const now = new Date();
  await database.transaction(async (tx) => {
    await tx
      .update(candidateProfiles)
      .set({ advisorId, updatedAt: now })
      .where(eq(candidateProfiles.id, candidateId));
    await tx.insert(candidateActivities).values({
      candidateId,
      type: 'candidate.advisor_assigned',
      metadata: { advisorId: advisorId ?? null },
    });
    // Open system work items follow the candidate to the new owner (or drop
    // back to the pool on unassign) instead of rotting with the old one.
    await tx
      .update(advisorTasks)
      .set({ assigneeUserId: advisorId, updatedAt: now })
      .where(
        and(
          eq(advisorTasks.candidateId, candidateId),
          eq(advisorTasks.status, 'open'),
          ne(advisorTasks.kind, 'manual'),
        ),
      );
  });
}

export async function addCandidateNote(
  principal: WorkspacePrincipal,
  candidateId: string,
  body: string,
): Promise<void> {
  assertStaff(principal);
  const text = body.trim();
  if (!text) throw new PublicFlowError('invalid_request');
  await requireCandidate(candidateId);
  const now = new Date();
  await database.insert(candidateNotes).values({
    authorUserId: principal.id,
    body: text.slice(0, 2000),
    candidateId,
  });
  await database
    .update(candidateProfiles)
    .set({ lastActivityAt: now, updatedAt: now })
    .where(eq(candidateProfiles.id, candidateId));
  await database.insert(candidateActivities).values({
    candidateId,
    metadata: {},
    type: 'candidate.note_added',
  });
}

export const appointmentOutcomes = ['completed', 'no_show', 'cancelled'] as const;
export type AppointmentOutcome = (typeof appointmentOutcomes)[number];

export const appointmentOutcomeResults = [
  'positive',
  'thinking',
  'negative',
] as const;
export type AppointmentOutcomeResult =
  (typeof appointmentOutcomeResults)[number];

export const candidateTouchpoints = ['called', 'emailed', 'no_answer'] as const;
export type CandidateTouchpoint = (typeof candidateTouchpoints)[number];

async function latestInquiryId(candidateId: string): Promise<string | null> {
  const [inquiry] = await database
    .select({ id: candidateInquiries.id })
    .from(candidateInquiries)
    .where(eq(candidateInquiries.candidateId, candidateId))
    .orderBy(desc(candidateInquiries.createdAt))
    .limit(1);
  return inquiry?.id ?? null;
}

// Appointments are a per-CANDIDATE lifecycle: a person who re-applies gets a
// new inquiry, but their pending appointment must stay the same one — so all
// state transitions look the candidate up across every inquiry.
async function latestCandidateAppointmentId(
  candidateId: string,
  status: 'requested' | 'scheduled',
): Promise<string | null> {
  const [appointment] = await database
    .select({ id: appointmentRequests.id })
    .from(appointmentRequests)
    .where(
      and(
        eq(appointmentRequests.candidateId, candidateId),
        eq(appointmentRequests.status, status),
      ),
    )
    .orderBy(desc(appointmentRequests.createdAt))
    .limit(1);
  return appointment?.id ?? null;
}

type PipelineExecutor =
  | typeof database
  | Parameters<Parameters<typeof database.transaction>[0]>[0];

async function touchCandidate(
  candidateId: string,
  now: Date,
  executor: PipelineExecutor = database,
) {
  await executor
    .update(candidateProfiles)
    .set({ lastActivityAt: now, updatedAt: now })
    .where(eq(candidateProfiles.id, candidateId));
}

// First real contact silently moves a fresh lead forward; any later stage is
// the advisor's own call and is never touched automatically.
async function bumpNewToContacted(
  candidateId: string,
  executor: PipelineExecutor = database,
) {
  const bumped = await executor
    .update(candidateProfiles)
    .set({ stage: 'contacted', updatedAt: new Date() })
    .where(
      and(
        eq(candidateProfiles.id, candidateId),
        eq(candidateProfiles.stage, 'new'),
      ),
    )
    .returning({ id: candidateProfiles.id });
  if (bumped.length) {
    await executor.insert(candidateActivities).values({
      candidateId,
      type: 'candidate.stage_changed',
      metadata: { from: 'new', to: 'contacted' },
    });
  }
}

async function candidateContact(candidateId: string) {
  const [contact] = await database
    .select({ email: contacts.email, firstName: contacts.firstName })
    .from(candidateProfiles)
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .where(eq(candidateProfiles.id, candidateId))
    .limit(1);
  return contact ?? null;
}

// The lead chose a language when they applied — confirmation mails follow it.
async function candidateLocale(candidateId: string): Promise<'tr' | 'en'> {
  const [inquiry] = await database
    .select({ locale: candidateInquiries.locale })
    .from(candidateInquiries)
    .where(eq(candidateInquiries.candidateId, candidateId))
    .orderBy(desc(candidateInquiries.createdAt))
    .limit(1);
  return inquiry?.locale === 'en' ? 'en' : 'tr';
}

async function sendAppointmentMail(
  candidateId: string,
  appointmentId: string,
  startsAt: Date,
  kind: 'rescheduled' | 'scheduled',
) {
  const contact = await candidateContact(candidateId);
  if (!contact?.email) return;
  await notificationService.enqueue({
    channel: 'email',
    idempotencyKey: `appointment-${kind}:${appointmentId}:${startsAt.getTime()}`,
    locale: await candidateLocale(candidateId),
    payload: {
      kind,
      name: contact.firstName,
      startsAt: startsAt.toISOString(),
    },
    recipient: contact.email,
    templateKey: 'appointment-scheduled',
  });
}

function parseFutureDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    throw new PublicFlowError('invalid_request');
  }
  return parsed;
}

/** Confirm the consultation appointment at the chosen time and email the lead. */
export async function scheduleAppointment(
  principal: WorkspacePrincipal,
  candidateId: string,
  input: { startsAt: string },
): Promise<void> {
  assertStaff(principal);
  await requireCandidate(candidateId);

  const startsAt = parseFutureDate(input.startsAt);
  const appointmentId = await latestCandidateAppointmentId(
    candidateId,
    'requested',
  );
  if (!appointmentId) {
    throw new PublicFlowError('appointment_not_found', 404);
  }

  const now = new Date();
  // One transaction: the confirmed slot, its activity trail and the closed
  // work items land together or not at all.
  await database.transaction(async (tx) => {
    // Atomic transition: only flip a still-'requested' row.
    const updated = await tx
      .update(appointmentRequests)
      .set({ status: 'scheduled', scheduledStartsAt: startsAt, updatedAt: now })
      .where(
        and(
          eq(appointmentRequests.id, appointmentId),
          eq(appointmentRequests.status, 'requested'),
        ),
      )
      .returning({ id: appointmentRequests.id });
    if (!updated.length) {
      throw new PublicFlowError('appointment_not_found', 404);
    }

    await touchCandidate(candidateId, now, tx);
    await tx.insert(candidateActivities).values({
      candidateId,
      type: 'candidate.appointment_scheduled',
      metadata: { startsAt: startsAt.toISOString() },
    });
    await bumpNewToContacted(candidateId, tx);
    await closeSystemTasks(
      candidateId,
      ['appointment_request', 'first_contact', 'follow_up', 'retry_contact'],
      principal.id,
      tx,
    );
  });
  await sendAppointmentMail(candidateId, appointmentId, startsAt, 'scheduled');
}

/**
 * Staff-initiated consultation: the advisor reached the lead (phone, chat…)
 * and books the meeting directly — no public request involved.
 */
export async function createAppointment(
  principal: WorkspacePrincipal,
  candidateId: string,
  input: { startsAt: string },
): Promise<void> {
  assertStaff(principal);
  await requireCandidate(candidateId);

  const startsAt = parseFutureDate(input.startsAt);
  const inquiryId = await latestInquiryId(candidateId);
  if (!inquiryId) {
    throw new PublicFlowError('appointment_not_found', 404);
  }

  const [active] = await database
    .select({ id: appointmentRequests.id })
    .from(appointmentRequests)
    .where(
      and(
        eq(appointmentRequests.candidateId, candidateId),
        inArray(appointmentRequests.status, ['requested', 'scheduled']),
      ),
    )
    .limit(1);
  if (active) {
    throw new PublicFlowError('appointment_exists', 409);
  }

  const now = new Date();
  const created = await database.transaction(async (tx) => {
    // The partial unique index (one active appointment per candidate) is the
    // real guard; the check above only produces the friendlier 409 earlier.
    const [row] = await tx
      .insert(appointmentRequests)
      .values({
        candidateId,
        createdByUserId: principal.id,
        inquiryId,
        scheduledStartsAt: startsAt,
        status: 'scheduled',
        timezone: 'Europe/Istanbul',
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: appointmentRequests.id });
    if (!row) {
      throw new PublicFlowError('appointment_exists', 409);
    }

    await touchCandidate(candidateId, now, tx);
    await tx.insert(candidateActivities).values({
      candidateId,
      type: 'candidate.appointment_scheduled',
      metadata: { by: principal.id, startsAt: startsAt.toISOString() },
    });
    await bumpNewToContacted(candidateId, tx);
    await closeSystemTasks(
      candidateId,
      ['appointment_request', 'first_contact', 'follow_up', 'retry_contact'],
      principal.id,
      tx,
    );
    return row;
  });
  await sendAppointmentMail(candidateId, created.id, startsAt, 'scheduled');
}

/** Move a scheduled consultation to a new time; the change is logged + mailed. */
export async function rescheduleAppointment(
  principal: WorkspacePrincipal,
  candidateId: string,
  input: { note?: string; startsAt: string },
): Promise<void> {
  assertStaff(principal);
  await requireCandidate(candidateId);

  const startsAt = parseFutureDate(input.startsAt);
  const appointmentId = await latestCandidateAppointmentId(
    candidateId,
    'scheduled',
  );
  if (!appointmentId) {
    throw new PublicFlowError('appointment_not_found', 404);
  }

  const [previous] = await database
    .select({ scheduledStartsAt: appointmentRequests.scheduledStartsAt })
    .from(appointmentRequests)
    .where(eq(appointmentRequests.id, appointmentId))
    .limit(1);

  const now = new Date();
  await database.transaction(async (tx) => {
    const updated = await tx
      .update(appointmentRequests)
      .set({ scheduledStartsAt: startsAt, updatedAt: now })
      .where(
        and(
          eq(appointmentRequests.id, appointmentId),
          eq(appointmentRequests.status, 'scheduled'),
        ),
      )
      .returning({ id: appointmentRequests.id });
    if (!updated.length) {
      throw new PublicFlowError('appointment_not_found', 404);
    }

    await touchCandidate(candidateId, now, tx);
    await tx.insert(candidateActivities).values({
      candidateId,
      type: 'candidate.appointment_rescheduled',
      metadata: {
        from: previous?.scheduledStartsAt?.toISOString() ?? null,
        note: input.note?.trim().slice(0, 500) || null,
        to: startsAt.toISOString(),
      },
    });
  });
  await sendAppointmentMail(candidateId, appointmentId, startsAt, 'rescheduled');
}

/**
 * Record the outcome of a scheduled consultation. Completed meetings carry a
 * verdict (positive / thinking / negative); negative verdicts, no-shows and
 * cancellations must explain themselves, "thinking" may set a follow-up date.
 */
export async function resolveAppointment(
  principal: WorkspacePrincipal,
  candidateId: string,
  input: {
    followUpAt?: string;
    note?: string;
    outcome: AppointmentOutcome;
    outcomeResult?: AppointmentOutcomeResult;
  },
): Promise<void> {
  assertStaff(principal);
  const candidate = await requireCandidate(candidateId);
  if (!appointmentOutcomes.includes(input.outcome)) {
    throw new PublicFlowError('invalid_request');
  }

  const note = input.note?.trim().slice(0, 2000) || null;
  const isCompleted = input.outcome === 'completed';
  const result = isCompleted ? (input.outcomeResult ?? null) : null;

  if (isCompleted && (!result || !appointmentOutcomeResults.includes(result))) {
    throw new PublicFlowError('appointment_result_required');
  }
  const noteRequired =
    input.outcome === 'no_show' ||
    input.outcome === 'cancelled' ||
    result === 'negative';
  if (noteRequired && !note) {
    throw new PublicFlowError('appointment_note_required');
  }

  let followUpAt: Date | null = null;
  if (result === 'thinking' && input.followUpAt) {
    followUpAt = parseFutureDate(input.followUpAt);
  }

  const appointmentId = await latestCandidateAppointmentId(
    candidateId,
    'scheduled',
  );
  if (!appointmentId) {
    throw new PublicFlowError('appointment_not_found', 404);
  }

  const now = new Date();
  await database.transaction(async (tx) => {
    const updated = await tx
      .update(appointmentRequests)
      .set({
        followUpAt,
        outcomeNote: note,
        outcomeResult: result,
        status: input.outcome,
        updatedAt: now,
      })
      .where(
        and(
          eq(appointmentRequests.id, appointmentId),
          eq(appointmentRequests.status, 'scheduled'),
        ),
      )
      .returning({ id: appointmentRequests.id });
    if (!updated.length) {
      throw new PublicFlowError('appointment_not_found', 404);
    }

    await touchCandidate(candidateId, now, tx);
    await tx.insert(candidateActivities).values({
      candidateId,
      type: 'candidate.appointment_resolved',
      metadata: {
        followUpAt: followUpAt?.toISOString() ?? null,
        outcome: input.outcome,
        result,
      },
    });
  });

  // "Thinking" keeps the lead alive as a follow-up task — with or without a
  // date, so nobody silently falls off the radar.
  if (result === 'thinking') {
    await spawnSystemTask({
      appointmentId,
      assigneeUserId:
        candidate.advisorId ??
        (principal.role === 'advisor' ? principal.id : null),
      candidateId,
      dueAt: followUpAt,
      kind: 'follow_up',
    });
  }
}

/** Quick contact log: the advisor called / emailed / could not reach the lead. */
export async function logCandidateTouchpoint(
  principal: WorkspacePrincipal,
  candidateId: string,
  input: { kind: CandidateTouchpoint; note?: string },
): Promise<void> {
  assertStaff(principal);
  const candidate = await requireCandidate(candidateId);
  if (!candidateTouchpoints.includes(input.kind)) {
    throw new PublicFlowError('invalid_request');
  }

  const now = new Date();
  await touchCandidate(candidateId, now);
  await database.insert(candidateActivities).values({
    candidateId,
    type: `candidate.contact_${input.kind}`,
    metadata: {
      by: principal.id,
      note: input.note?.trim().slice(0, 500) || null,
    },
  });
  if (input.kind === 'called' || input.kind === 'emailed') {
    await bumpNewToContacted(candidateId);
    await closeSystemTasks(
      candidateId,
      ['first_contact', 'retry_contact'],
      principal.id,
    );
  } else {
    // No answer: queue a retry for the owner (or whoever just tried).
    await spawnSystemTask({
      assigneeUserId:
        candidate.advisorId ??
        (principal.role === 'advisor' ? principal.id : null),
      candidateId,
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      kind: 'retry_contact',
    });
  }
}
