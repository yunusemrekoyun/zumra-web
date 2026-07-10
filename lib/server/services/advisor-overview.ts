import 'server-only';

import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { isoToIstanbulWallClock, istanbulWallClockToISO } from '@/lib/datetime';
import { database } from '@/lib/server/db/client';
import {
  appointmentPreferences,
  appointmentRequests,
  candidateProfiles,
  contacts,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';

function assertStaff(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

export type AppointmentOverviewRow = {
  candidateId: string;
  candidateName: string;
  createdAt: string;
  id: string;
  outcomeNote: string | null;
  preferences: string[];
  scheduledStartsAt: string | null;
  status: 'cancelled' | 'completed' | 'no_show' | 'requested' | 'scheduled';
};

export type AdvisorOverview = {
  myAssignedCount: number;
  newThisWeek: number;
  pendingRequests: AppointmentOverviewRow[];
  stageCounts: Record<string, number>;
  todaysMeetings: AppointmentOverviewRow[];
  upcoming: AppointmentOverviewRow[];
};

async function appointmentRows(
  where: ReturnType<typeof and>,
  order: 'asc' | 'desc',
  limit: number,
): Promise<AppointmentOverviewRow[]> {
  const rows = await database
    .select({
      candidateId: appointmentRequests.candidateId,
      createdAt: appointmentRequests.createdAt,
      firstName: contacts.firstName,
      id: appointmentRequests.id,
      lastName: contacts.lastName,
      outcomeNote: appointmentRequests.outcomeNote,
      scheduledStartsAt: appointmentRequests.scheduledStartsAt,
      status: appointmentRequests.status,
    })
    .from(appointmentRequests)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, appointmentRequests.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .where(where)
    .orderBy(
      order === 'asc'
        ? asc(appointmentRequests.scheduledStartsAt)
        : desc(appointmentRequests.createdAt),
    )
    .limit(limit);

  const requestIds = rows.map((row) => row.id);
  const preferences = requestIds.length
    ? await database
        .select({
          requestId: appointmentPreferences.requestId,
          startsAt: appointmentPreferences.startsAt,
        })
        .from(appointmentPreferences)
        .where(inArray(appointmentPreferences.requestId, requestIds))
        .orderBy(asc(appointmentPreferences.rank))
    : [];

  return rows.map((row) => ({
    candidateId: row.candidateId,
    candidateName: `${row.firstName} ${row.lastName}`.trim(),
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    outcomeNote: row.outcomeNote,
    preferences: preferences
      .filter((preference) => preference.requestId === row.id)
      .map((preference) => preference.startsAt.toISOString()),
    scheduledStartsAt: row.scheduledStartsAt?.toISOString() ?? null,
    status: row.status,
  }));
}

/** Istanbul-local [00:00, 24:00) window that contains the given instant. */
function istanbulDayWindow(now: Date) {
  const localDate = isoToIstanbulWallClock(now.toISOString()).slice(0, 10);
  const dayStart = new Date(istanbulWallClockToISO(`${localDate}T00:00`));
  return { dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000), dayStart };
}

export async function getAdvisorOverview(
  principal: WorkspacePrincipal,
): Promise<AdvisorOverview> {
  assertStaff(principal);

  const now = new Date();
  const { dayEnd, dayStart } = istanbulDayWindow(now);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [stageRows, [assigned], [fresh], pendingRequests, upcoming, todaysMeetings] =
    await Promise.all([
      database
        .select({
          count: sql<number>`count(*)::int`,
          stage: candidateProfiles.stage,
        })
        .from(candidateProfiles)
        .groupBy(candidateProfiles.stage),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.advisorId, principal.id)),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(candidateProfiles)
        .where(gte(candidateProfiles.createdAt, weekAgo)),
      appointmentRows(
        and(eq(appointmentRequests.status, 'requested')),
        'desc',
        6,
      ),
      appointmentRows(
        and(
          eq(appointmentRequests.status, 'scheduled'),
          gte(appointmentRequests.scheduledStartsAt, now),
        ),
        'asc',
        6,
      ),
      appointmentRows(
        and(
          eq(appointmentRequests.status, 'scheduled'),
          gte(appointmentRequests.scheduledStartsAt, dayStart),
          lt(appointmentRequests.scheduledStartsAt, dayEnd),
        ),
        'asc',
        10,
      ),
    ]);

  return {
    myAssignedCount: assigned?.count ?? 0,
    newThisWeek: fresh?.count ?? 0,
    pendingRequests,
    stageCounts: Object.fromEntries(
      stageRows.map((row) => [row.stage, row.count]),
    ),
    todaysMeetings,
    upcoming,
  };
}

export type AppointmentsOverview = {
  past: AppointmentOverviewRow[];
  requested: AppointmentOverviewRow[];
  scheduled: AppointmentOverviewRow[];
};

export async function listAppointmentsOverview(
  principal: WorkspacePrincipal,
): Promise<AppointmentsOverview> {
  assertStaff(principal);

  const [requested, scheduled, past] = await Promise.all([
    appointmentRows(and(eq(appointmentRequests.status, 'requested')), 'desc', 50),
    appointmentRows(and(eq(appointmentRequests.status, 'scheduled')), 'asc', 50),
    appointmentRows(
      and(
        inArray(appointmentRequests.status, [
          'cancelled',
          'completed',
          'no_show',
        ]),
      ),
      'desc',
      30,
    ),
  ]);

  return { past, requested, scheduled };
}
