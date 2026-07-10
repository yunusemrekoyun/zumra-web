import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  appointmentRequests,
  candidateActivities,
  candidateNotes,
  candidateProfiles,
  contacts,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

export type PersonJourney = {
  activities: Array<{
    id: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
    type: string;
  }>;
  advisorId: string | null;
  advisorName: string | null;
  appointments: Array<{
    id: string;
    outcomeNote: string | null;
    outcomeResult: string | null;
    scheduledStartsAt: string | null;
    status: string;
  }>;
  candidateId: string;
  email: string;
  firstSeenAt: string;
  fullName: string;
  notes: Array<{
    authorName: string | null;
    body: string;
    createdAt: string;
    id: string;
  }>;
  phone: string | null;
  stage: string;
};

/**
 * The whole road one person has travelled — from the first public inquiry
 * through consultations to enrollment. Staff-only: journeys carry advisor
 * notes and CRM history that students and teachers must never see.
 */
export async function getPersonJourney(
  principal: WorkspacePrincipal,
  candidateId: string,
): Promise<PersonJourney | null> {
  assertStaff(principal);

  const [profile] = await database
    .select({
      advisorId: candidateProfiles.advisorId,
      advisorName: users.name,
      createdAt: candidateProfiles.createdAt,
      email: contacts.email,
      firstName: contacts.firstName,
      id: candidateProfiles.id,
      lastName: contacts.lastName,
      phone: contacts.phone,
      stage: candidateProfiles.stage,
    })
    .from(candidateProfiles)
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .leftJoin(users, eq(users.id, candidateProfiles.advisorId))
    .where(eq(candidateProfiles.id, candidateId))
    .limit(1);
  if (!profile) return null;

  const [activities, notes, appointments] = await Promise.all([
    database
      .select({
        id: candidateActivities.id,
        metadata: candidateActivities.metadata,
        occurredAt: candidateActivities.occurredAt,
        type: candidateActivities.type,
      })
      .from(candidateActivities)
      .where(eq(candidateActivities.candidateId, candidateId))
      .orderBy(desc(candidateActivities.occurredAt))
      .limit(100),
    database
      .select({
        authorName: users.name,
        body: candidateNotes.body,
        createdAt: candidateNotes.createdAt,
        id: candidateNotes.id,
      })
      .from(candidateNotes)
      .leftJoin(users, eq(users.id, candidateNotes.authorUserId))
      .where(eq(candidateNotes.candidateId, candidateId))
      .orderBy(desc(candidateNotes.createdAt))
      .limit(50),
    database
      .select({
        id: appointmentRequests.id,
        outcomeNote: appointmentRequests.outcomeNote,
        outcomeResult: appointmentRequests.outcomeResult,
        scheduledStartsAt: appointmentRequests.scheduledStartsAt,
        status: appointmentRequests.status,
      })
      .from(appointmentRequests)
      .where(eq(appointmentRequests.candidateId, candidateId))
      .orderBy(desc(appointmentRequests.createdAt))
      .limit(20),
  ]);

  return {
    activities: activities.map((activity) => ({
      id: activity.id,
      metadata: (activity.metadata ?? {}) as Record<string, unknown>,
      occurredAt: activity.occurredAt.toISOString(),
      type: activity.type,
    })),
    advisorId: profile.advisorId,
    advisorName: profile.advisorName,
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      outcomeNote: appointment.outcomeNote,
      outcomeResult: appointment.outcomeResult,
      scheduledStartsAt: appointment.scheduledStartsAt?.toISOString() ?? null,
      status: appointment.status,
    })),
    candidateId: profile.id,
    email: profile.email,
    firstSeenAt: profile.createdAt.toISOString(),
    fullName: `${profile.firstName} ${profile.lastName}`.trim(),
    notes: notes.map((note) => ({
      authorName: note.authorName,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      id: note.id,
    })),
    phone: profile.phone,
    stage: profile.stage,
  };
}

export type AdvisorStudentSummary = {
  candidateId: string;
  currentLevel: string | null;
  fullName: string;
  status: string;
  studentId: string;
};

/** Bridge: a student profile back to their candidate record (staff view). */
export async function getStudentJourneyContext(
  principal: WorkspacePrincipal,
  studentId: string,
): Promise<AdvisorStudentSummary | null> {
  assertStaff(principal);

  const [student] = await database
    .select({
      candidateId: studentProfiles.candidateId,
      currentLevel: studentProfiles.currentLevel,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      status: studentProfiles.status,
      studentId: studentProfiles.id,
    })
    .from(studentProfiles)
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .where(and(eq(studentProfiles.id, studentId)))
    .limit(1);
  if (!student?.candidateId) return null;

  return {
    candidateId: student.candidateId,
    currentLevel: student.currentLevel,
    fullName: `${student.firstName} ${student.lastName}`.trim(),
    status: student.status,
    studentId: student.studentId,
  };
}
