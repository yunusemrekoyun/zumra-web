import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  candidateActivities,
  candidateNotes,
  candidateProfiles,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';

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
