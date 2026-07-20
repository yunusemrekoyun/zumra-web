import 'server-only';

import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  advisorTasks,
  auditLogs,
  candidateProfiles,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';

const THIRTY_DAYS_MS = 30 * 86_400_000;

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

export type AdvisorScorecardSummary = {
  activities30d: number;
  assignedCandidates: number;
  conversionPercent: number;
  email: string;
  enrolledCandidates: number;
  fullName: string;
  lastActivityAt: string | null;
  openTasks: number;
  userId: string;
};

// Directory view: one card per advisor with headline numbers. The per-advisor
// figures come from grouped subqueries so the page stays a handful of queries
// regardless of advisor count.
export async function listAdvisorScorecards(
  principal: WorkspacePrincipal,
): Promise<AdvisorScorecardSummary[]> {
  assertAdmin(principal);

  const monthAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  const [advisors, candidateRows, taskRows, activityRows] = await Promise.all([
    database
      .select({ email: users.email, id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, 'advisor'), eq(users.accountStatus, 'active')))
      .orderBy(users.name),
    database
      .select({
        advisorId: candidateProfiles.advisorId,
        assigned: count(),
        enrolled: count(
          sql`case when ${candidateProfiles.stage} = 'enrolled' then 1 end`,
        ),
      })
      .from(candidateProfiles)
      .groupBy(candidateProfiles.advisorId),
    database
      .select({
        assigneeUserId: advisorTasks.assigneeUserId,
        open: count(sql`case when ${advisorTasks.status} = 'open' then 1 end`),
      })
      .from(advisorTasks)
      .groupBy(advisorTasks.assigneeUserId),
    database
      .select({
        actorUserId: auditLogs.actorUserId,
        lastAt: sql<Date>`max(${auditLogs.createdAt})`,
        recent: count(
          sql`case when ${auditLogs.createdAt} >= ${monthAgo} then 1 end`,
        ),
      })
      .from(auditLogs)
      .groupBy(auditLogs.actorUserId),
  ]);

  const candidatesByAdvisor = new Map(
    candidateRows.map((row) => [row.advisorId, row]),
  );
  const tasksByOwner = new Map(
    taskRows.map((row) => [row.assigneeUserId, row]),
  );
  const activityByActor = new Map(
    activityRows.map((row) => [row.actorUserId, row]),
  );

  return advisors.map((advisor) => {
    const candidates = candidatesByAdvisor.get(advisor.id);
    const assigned = Number(candidates?.assigned ?? 0);
    const enrolled = Number(candidates?.enrolled ?? 0);
    const activity = activityByActor.get(advisor.id);

    return {
      activities30d: Number(activity?.recent ?? 0),
      assignedCandidates: assigned,
      conversionPercent: assigned
        ? Math.round((enrolled / assigned) * 100)
        : 0,
      email: advisor.email,
      enrolledCandidates: enrolled,
      fullName: advisor.name,
      lastActivityAt: activity?.lastAt
        ? new Date(activity.lastAt).toISOString()
        : null,
      openTasks: Number(tasksByOwner.get(advisor.id)?.open ?? 0),
      userId: advisor.id,
    };
  });
}

export type AdvisorScorecardDetail = {
  activityFeed: Array<{
    action: string;
    createdAt: string;
    result: string;
    targetType: string;
  }>;
  advisor: {
    email: string;
    fullName: string;
    memberSince: string;
    userId: string;
  };
  kpis: {
    activities30d: number;
    appointmentsCompleted30d: number;
    appointmentsScheduled30d: number;
    assignedCandidates: number;
    conversionPercent: number;
    enrolledCandidates: number;
    openTasks: number;
    tasksCompleted30d: number;
  };
  stageCounts: Record<string, number>;
  weeklyActivity: Array<{ count: number; weekStart: string }>;
};

export async function getAdvisorScorecard(
  principal: WorkspacePrincipal,
  advisorUserId: string,
): Promise<AdvisorScorecardDetail> {
  assertAdmin(principal);

  const [advisor] = await database
    .select({
      createdAt: users.createdAt,
      email: users.email,
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(and(eq(users.id, advisorUserId), eq(users.role, 'advisor')))
    .limit(1);
  if (!advisor) {
    throw new PublicFlowError('advisor_not_found', 404);
  }

  const now = Date.now();
  const monthAgo = new Date(now - THIRTY_DAYS_MS);
  const eightWeeksAgo = new Date(now - 56 * 86_400_000);

  const [
    stageRows,
    [taskCounts],
    [appointmentCounts],
    activityFeed,
    weeklyRows,
    [activityTotals],
  ] = await Promise.all([
    database
      .select({ count: count(), stage: candidateProfiles.stage })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.advisorId, advisor.id))
      .groupBy(candidateProfiles.stage),
    database
      .select({
        completed30d: count(
          sql`case when ${advisorTasks.completedByUserId} = ${advisor.id} and ${advisorTasks.completedAt} >= ${monthAgo} then 1 end`,
        ),
        open: count(
          sql`case when ${advisorTasks.assigneeUserId} = ${advisor.id} and ${advisorTasks.status} = 'open' then 1 end`,
        ),
      })
      .from(advisorTasks),
    // Appointment work is attributed through the audit trail (the appointment
    // rows themselves only record their creator).
    database
      .select({
        completed30d: count(
          sql`case when ${auditLogs.action} = 'candidate.appointment_resolve' then 1 end`,
        ),
        scheduled30d: count(
          sql`case when ${auditLogs.action} in ('candidate.appointment_schedule', 'candidate.appointment_reschedule') then 1 end`,
        ),
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actorUserId, advisor.id),
          gte(auditLogs.createdAt, monthAgo),
        ),
      ),
    database
      .select({
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
        result: auditLogs.result,
        targetType: auditLogs.targetType,
      })
      .from(auditLogs)
      .where(eq(auditLogs.actorUserId, advisor.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
    database
      .select({
        count: count(),
        weekStart: sql<string>`date_trunc('week', ${auditLogs.createdAt} at time zone 'Europe/Istanbul')::date`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actorUserId, advisor.id),
          gte(auditLogs.createdAt, eightWeeksAgo),
        ),
      )
      .groupBy(
        sql`date_trunc('week', ${auditLogs.createdAt} at time zone 'Europe/Istanbul')::date`,
      )
      .orderBy(
        sql`date_trunc('week', ${auditLogs.createdAt} at time zone 'Europe/Istanbul')::date`,
      ),
    database
      .select({
        recent: count(
          sql`case when ${auditLogs.createdAt} >= ${monthAgo} then 1 end`,
        ),
      })
      .from(auditLogs)
      .where(eq(auditLogs.actorUserId, advisor.id)),
  ]);

  const stageCounts = Object.fromEntries(
    stageRows.map((row) => [row.stage, Number(row.count)]),
  );
  const assigned = Object.values(stageCounts).reduce(
    (acc, value) => acc + value,
    0,
  );
  const enrolled = stageCounts.enrolled ?? 0;

  return {
    activityFeed: activityFeed.map((row) => ({
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      result: row.result,
      targetType: row.targetType,
    })),
    advisor: {
      email: advisor.email,
      fullName: advisor.name,
      memberSince: advisor.createdAt.toISOString(),
      userId: advisor.id,
    },
    kpis: {
      activities30d: Number(activityTotals?.recent ?? 0),
      appointmentsCompleted30d: Number(appointmentCounts?.completed30d ?? 0),
      appointmentsScheduled30d: Number(appointmentCounts?.scheduled30d ?? 0),
      assignedCandidates: assigned,
      conversionPercent: assigned
        ? Math.round((enrolled / assigned) * 100)
        : 0,
      enrolledCandidates: enrolled,
      openTasks: Number(taskCounts?.open ?? 0),
      tasksCompleted30d: Number(taskCounts?.completed30d ?? 0),
    },
    stageCounts,
    weeklyActivity: weeklyRows.map((row) => ({
      count: Number(row.count),
      weekStart: String(row.weekStart),
    })),
  };
}
