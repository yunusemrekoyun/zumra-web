import 'server-only';

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  appointmentRequests,
  candidateActivities,
  candidateInquiries,
  candidateNotes,
  candidateProfiles,
  contacts,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
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

const STAFF_ROLES = ['admin', 'advisor'] as const;

export type AdvisorOption = { id: string; name: string };

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

async function requireCandidate(candidateId: string) {
  const [row] = await database
    .select({ id: candidateProfiles.id, stage: candidateProfiles.stage })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, candidateId))
    .limit(1);
  if (!row) throw new PublicFlowError('candidate_not_found', 404);
  return row;
}

export async function listAdvisors(
  principal: WorkspacePrincipal,
): Promise<AdvisorOption[]> {
  assertStaff(principal);
  return database
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.role, [...STAFF_ROLES]))
    .orderBy(asc(users.name));
}

export async function updateCandidateStage(
  principal: WorkspacePrincipal,
  candidateId: string,
  stage: CandidateStage,
): Promise<void> {
  assertStaff(principal);
  if (!candidateStages.includes(stage)) {
    throw new PublicFlowError('invalid_request');
  }
  const existing = await requireCandidate(candidateId);
  if (existing.stage === stage) return;
  const now = new Date();
  await database
    .update(candidateProfiles)
    .set({ stage, lastActivityAt: now, updatedAt: now })
    .where(eq(candidateProfiles.id, candidateId));
  await database.insert(candidateActivities).values({
    candidateId,
    type: 'candidate.stage_changed',
    metadata: { from: existing.stage, to: stage },
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
      .where(
        and(eq(users.id, advisorId), inArray(users.role, [...STAFF_ROLES])),
      )
      .limit(1);
    if (!advisor) throw new PublicFlowError('invalid_request');
  }
  await requireCandidate(candidateId);
  const now = new Date();
  await database
    .update(candidateProfiles)
    .set({ advisorId, updatedAt: now })
    .where(eq(candidateProfiles.id, candidateId));
  await database.insert(candidateActivities).values({
    candidateId,
    type: 'candidate.advisor_assigned',
    metadata: { advisorId: advisorId ?? null },
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

// Act on the SAME appointment the candidate drawer displays: the one attached
// to the candidate's most recent inquiry (mirrors candidate-directory), and
// only when it is in the expected state.
async function latestInquiryAppointmentId(
  candidateId: string,
  status: 'requested' | 'scheduled',
): Promise<string | null> {
  const inquiryId = await latestInquiryId(candidateId);
  if (!inquiryId) return null;

  const [appointment] = await database
    .select({ id: appointmentRequests.id })
    .from(appointmentRequests)
    .where(
      and(
        eq(appointmentRequests.inquiryId, inquiryId),
        eq(appointmentRequests.status, status),
      ),
    )
    .orderBy(desc(appointmentRequests.createdAt))
    .limit(1);
  return appointment?.id ?? null;
}

async function touchCandidate(candidateId: string, now: Date) {
  await database
    .update(candidateProfiles)
    .set({ lastActivityAt: now, updatedAt: now })
    .where(eq(candidateProfiles.id, candidateId));
}

// First real contact silently moves a fresh lead forward; any later stage is
// the advisor's own call and is never touched automatically.
async function bumpNewToContacted(candidateId: string) {
  const bumped = await database
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
    await database.insert(candidateActivities).values({
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
    locale: 'tr',
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
  const appointmentId = await latestInquiryAppointmentId(
    candidateId,
    'requested',
  );
  if (!appointmentId) {
    throw new PublicFlowError('appointment_not_found', 404);
  }

  const now = new Date();
  // Atomic transition: only flip a still-'requested' row.
  const updated = await database
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

  await touchCandidate(candidateId, now);
  await database.insert(candidateActivities).values({
    candidateId,
    type: 'candidate.appointment_scheduled',
    metadata: { startsAt: startsAt.toISOString() },
  });
  await bumpNewToContacted(candidateId);
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
        eq(appointmentRequests.inquiryId, inquiryId),
        inArray(appointmentRequests.status, ['requested', 'scheduled']),
      ),
    )
    .limit(1);
  if (active) {
    throw new PublicFlowError('appointment_exists', 409);
  }

  const now = new Date();
  const [created] = await database
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
    .returning({ id: appointmentRequests.id });

  await touchCandidate(candidateId, now);
  await database.insert(candidateActivities).values({
    candidateId,
    type: 'candidate.appointment_scheduled',
    metadata: { by: principal.id, startsAt: startsAt.toISOString() },
  });
  await bumpNewToContacted(candidateId);
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
  const appointmentId = await latestInquiryAppointmentId(
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
  const updated = await database
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

  await touchCandidate(candidateId, now);
  await database.insert(candidateActivities).values({
    candidateId,
    type: 'candidate.appointment_rescheduled',
    metadata: {
      from: previous?.scheduledStartsAt?.toISOString() ?? null,
      note: input.note?.trim().slice(0, 500) || null,
      to: startsAt.toISOString(),
    },
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
  await requireCandidate(candidateId);
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

  const appointmentId = await latestInquiryAppointmentId(
    candidateId,
    'scheduled',
  );
  if (!appointmentId) {
    throw new PublicFlowError('appointment_not_found', 404);
  }

  const now = new Date();
  const updated = await database
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

  await touchCandidate(candidateId, now);
  await database.insert(candidateActivities).values({
    candidateId,
    type: 'candidate.appointment_resolved',
    metadata: {
      followUpAt: followUpAt?.toISOString() ?? null,
      outcome: input.outcome,
      result,
    },
  });
}

/** Quick contact log: the advisor called / emailed / could not reach the lead. */
export async function logCandidateTouchpoint(
  principal: WorkspacePrincipal,
  candidateId: string,
  input: { kind: CandidateTouchpoint; note?: string },
): Promise<void> {
  assertStaff(principal);
  await requireCandidate(candidateId);
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
  }
}
