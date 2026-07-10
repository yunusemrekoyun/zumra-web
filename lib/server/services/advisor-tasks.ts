import 'server-only';

import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { isoToIstanbulWallClock, istanbulWallClockToISO } from '@/lib/datetime';
import { database } from '@/lib/server/db/client';
import {
  advisorTasks,
  candidateActivities,
  candidateProfiles,
  contacts,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

export type AdvisorTaskKind =
  | 'appointment_request'
  | 'first_contact'
  | 'follow_up'
  | 'manual'
  | 'retry_contact';

export type AdvisorTaskRow = {
  candidateId: string | null;
  candidateName: string | null;
  createdAt: string;
  dueAt: string | null;
  id: string;
  kind: AdvisorTaskKind;
  note: string | null;
  overdue: boolean;
  title: string | null;
  visibility: 'private' | 'staff';
};

export type AdvisorTaskBoard = {
  doneToday: AdvisorTaskRow[];
  mine: AdvisorTaskRow[];
  pool: AdvisorTaskRow[];
};

type SystemTaskKind =
  | 'appointment_request'
  | 'first_contact'
  | 'follow_up'
  | 'retry_contact';

/* ─── Internal engine: tasks are born from CRM events and closed by the
       action that satisfies them. Duplicate-safe via the partial unique. ─── */

export async function spawnSystemTask(input: {
  appointmentId?: string | null;
  assigneeUserId: string | null;
  candidateId: string;
  dueAt?: Date | null;
  kind: SystemTaskKind;
}): Promise<void> {
  await database
    .insert(advisorTasks)
    .values({
      appointmentId: input.appointmentId ?? null,
      assigneeUserId: input.assigneeUserId,
      candidateId: input.candidateId,
      dueAt: input.dueAt ?? null,
      kind: input.kind,
      visibility: 'staff',
    })
    .onConflictDoNothing();
}

export async function closeSystemTasks(
  candidateId: string,
  kinds: ReadonlyArray<SystemTaskKind>,
  completedByUserId: string,
): Promise<void> {
  const now = new Date();
  await database
    .update(advisorTasks)
    .set({
      completedAt: now,
      completedByUserId,
      status: 'done',
      updatedAt: now,
    })
    .where(
      and(
        eq(advisorTasks.candidateId, candidateId),
        eq(advisorTasks.status, 'open'),
        inArray(advisorTasks.kind, [...kinds]),
      ),
    );
}

/** When a candidate gains an owner, their pool tasks follow the owner. */
export async function reassignPoolTasks(
  candidateId: string,
  assigneeUserId: string,
): Promise<void> {
  await database
    .update(advisorTasks)
    .set({ assigneeUserId, updatedAt: new Date() })
    .where(
      and(
        eq(advisorTasks.candidateId, candidateId),
        eq(advisorTasks.status, 'open'),
        isNull(advisorTasks.assigneeUserId),
      ),
    );
}

/* ─── Staff-facing API ──────────────────────────────────────────────── */

function istanbulDayWindow(now: Date) {
  const localDate = isoToIstanbulWallClock(now.toISOString()).slice(0, 10);
  const dayStart = new Date(istanbulWallClockToISO(`${localDate}T00:00`));
  return { dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000), dayStart };
}

function mapRow(
  row: {
    candidateId: string | null;
    createdAt: Date;
    dueAt: Date | null;
    firstName: string | null;
    id: string;
    kind: AdvisorTaskKind;
    lastName: string | null;
    note: string | null;
    title: string | null;
    visibility: 'private' | 'staff';
  },
  now: Date,
): AdvisorTaskRow {
  return {
    candidateId: row.candidateId,
    candidateName: row.firstName
      ? `${row.firstName} ${row.lastName ?? ''}`.trim()
      : null,
    createdAt: row.createdAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    id: row.id,
    kind: row.kind,
    note: row.note,
    overdue: Boolean(row.dueAt && row.dueAt.getTime() < now.getTime()),
    title: row.title,
    visibility: row.visibility,
  };
}

const baseSelect = {
  candidateId: advisorTasks.candidateId,
  createdAt: advisorTasks.createdAt,
  dueAt: advisorTasks.dueAt,
  firstName: contacts.firstName,
  id: advisorTasks.id,
  kind: advisorTasks.kind,
  lastName: contacts.lastName,
  note: advisorTasks.note,
  title: advisorTasks.title,
  visibility: advisorTasks.visibility,
};

function taskQuery() {
  return database
    .select(baseSelect)
    .from(advisorTasks)
    .leftJoin(
      candidateProfiles,
      eq(candidateProfiles.id, advisorTasks.candidateId),
    )
    .leftJoin(contacts, eq(contacts.id, candidateProfiles.contactId));
}

export async function listAdvisorTasks(
  principal: WorkspacePrincipal,
): Promise<AdvisorTaskBoard> {
  assertStaff(principal);

  const now = new Date();
  const { dayEnd, dayStart } = istanbulDayWindow(now);
  const dueOrder = [
    sql`${advisorTasks.dueAt} asc nulls last`,
    asc(advisorTasks.createdAt),
  ];

  const [pool, mine, doneToday] = await Promise.all([
    taskQuery()
      .where(
        and(
          eq(advisorTasks.status, 'open'),
          isNull(advisorTasks.assigneeUserId),
          eq(advisorTasks.visibility, 'staff'),
        ),
      )
      .orderBy(...dueOrder)
      .limit(50),
    taskQuery()
      .where(
        and(
          eq(advisorTasks.status, 'open'),
          eq(advisorTasks.assigneeUserId, principal.id),
        ),
      )
      .orderBy(...dueOrder)
      .limit(100),
    taskQuery()
      .where(
        and(
          eq(advisorTasks.status, 'done'),
          eq(advisorTasks.completedByUserId, principal.id),
          gte(advisorTasks.completedAt, dayStart),
          lt(advisorTasks.completedAt, dayEnd),
        ),
      )
      .orderBy(desc(advisorTasks.completedAt))
      .limit(30),
  ]);

  return {
    doneToday: doneToday.map((row) => mapRow(row, now)),
    mine: mine.map((row) => mapRow(row, now)),
    pool: pool.map((row) => mapRow(row, now)),
  };
}

export async function createManualTask(
  principal: WorkspacePrincipal,
  input: { dueAt?: string; note?: string; title: string },
): Promise<void> {
  assertStaff(principal);
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new PublicFlowError('invalid_request');

  let dueAt: Date | null = null;
  if (input.dueAt) {
    dueAt = new Date(input.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      throw new PublicFlowError('invalid_request');
    }
  }

  await database.insert(advisorTasks).values({
    assigneeUserId: principal.id,
    createdByUserId: principal.id,
    dueAt,
    kind: 'manual',
    note: input.note?.trim().slice(0, 1000) || null,
    title,
    visibility: 'private',
  });
}

/** Atomically take a pool task; the claimer becomes the candidate's advisor. */
export async function claimTask(
  principal: WorkspacePrincipal,
  taskId: string,
): Promise<void> {
  assertStaff(principal);
  // Claiming implies ownership, and only advisors can own candidates —
  // admins steer processes from outside but never take the seat themselves.
  if (principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Only advisors can claim tasks.');
  }

  const now = new Date();
  const [claimed] = await database
    .update(advisorTasks)
    .set({ assigneeUserId: principal.id, updatedAt: now })
    .where(
      and(
        eq(advisorTasks.id, taskId),
        eq(advisorTasks.status, 'open'),
        isNull(advisorTasks.assigneeUserId),
      ),
    )
    .returning({ candidateId: advisorTasks.candidateId });
  if (!claimed) {
    throw new PublicFlowError('task_taken', 409);
  }

  if (claimed.candidateId) {
    await database
      .update(candidateProfiles)
      .set({ advisorId: principal.id, updatedAt: now })
      .where(eq(candidateProfiles.id, claimed.candidateId));
    await database.insert(candidateActivities).values({
      candidateId: claimed.candidateId,
      metadata: { advisorId: principal.id },
      type: 'candidate.advisor_assigned',
    });
    // Sibling pool tasks of the same candidate follow the new owner too.
    await reassignPoolTasks(claimed.candidateId, principal.id);
  }
}

export async function completeTask(
  principal: WorkspacePrincipal,
  taskId: string,
): Promise<void> {
  assertStaff(principal);

  const now = new Date();
  const ownGuard =
    principal.role === 'admin'
      ? undefined
      : eq(advisorTasks.assigneeUserId, principal.id);
  const [completed] = await database
    .update(advisorTasks)
    .set({
      completedAt: now,
      completedByUserId: principal.id,
      status: 'done',
      updatedAt: now,
    })
    .where(
      and(
        eq(advisorTasks.id, taskId),
        eq(advisorTasks.status, 'open'),
        ownGuard,
      ),
    )
    .returning({ id: advisorTasks.id });
  if (!completed) {
    throw new PublicFlowError('task_not_found', 404);
  }
}
