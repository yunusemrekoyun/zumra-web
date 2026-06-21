import 'server-only';

import { and, asc, eq, inArray, or } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  assignments,
  assignmentSubmissions,
  enrollments,
  lessonAttendanceRecords,
  lessonSessions,
  studentProfiles,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError } from '@/lib/server/http/errors';

const activeEnrollmentStatuses = ['active', 'paused'] as const;
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

// Composite weights (grade and completion are deliberately separate factors).
const WEIGHTS = { grade: 0.4, completion: 0.3, attendance: 0.3 };
// XP point values (the accumulating gamification number).
const XP = { present: 5, late: 3, submit: 10, gradeMax: 20 };
const READY_THRESHOLD = 80;

export type ProgressBadge = { key: string; earned: boolean };

export type StudentProgress = {
  hasData: boolean;
  level: {
    current: string;
    next?: string;
    masteryPercent: number;
    readyToAdvance: boolean;
  };
  developmentScore: number;
  xp: number;
  streak: number;
  breakdown: {
    completionPercent: number;
    gradePercent: number;
    attendancePercent: number;
  };
  counts: {
    assignedHomework: number;
    submitted: number;
    graded: number;
    attended: number;
    lessons: number;
  };
  badges: ProgressBadge[];
  gradeTrend: Array<{ date: string; percent: number }>;
};

function emptyProgress(level: string): StudentProgress {
  const idx = CEFR.indexOf(level as (typeof CEFR)[number]);
  return {
    hasData: false,
    level: {
      current: level,
      next: idx >= 0 && idx < CEFR.length - 1 ? CEFR[idx + 1] : undefined,
      masteryPercent: 0,
      readyToAdvance: false,
    },
    developmentScore: 0,
    xp: 0,
    streak: 0,
    breakdown: { completionPercent: 0, gradePercent: 0, attendancePercent: 0 },
    counts: {
      assignedHomework: 0,
      submitted: 0,
      graded: 0,
      attended: 0,
      lessons: 0,
    },
    badges: [],
    gradeTrend: [],
  };
}

export async function getStudentProgress(
  principal: WorkspacePrincipal,
): Promise<StudentProgress> {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const [profile] = await database
    .select({
      id: studentProfiles.id,
      currentLevel: studentProfiles.currentLevel,
    })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);
  if (!profile) return emptyProgress('A1');

  const level = profile.currentLevel ?? 'A1';

  // Active relationships → which homework targets this student.
  const enr = await database
    .select({ enrollmentId: enrollments.id, branchId: enrollments.branchId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, profile.id),
        inArray(enrollments.status, activeEnrollmentStatuses),
      ),
    );
  const branchIds = enr
    .map((e) => e.branchId)
    .filter((v): v is string => Boolean(v));
  const enrollmentIds = enr.map((e) => e.enrollmentId);

  const targetConditions = [];
  if (branchIds.length) {
    targetConditions.push(
      and(
        eq(assignments.targetType, 'branch'),
        inArray(assignments.targetBranchId, branchIds),
      ),
    );
  }
  if (enrollmentIds.length) {
    targetConditions.push(
      and(
        eq(assignments.targetType, 'student'),
        inArray(assignments.targetEnrollmentId, enrollmentIds),
      ),
    );
  }

  // Homework only (materials excluded from completion).
  const hwRows = targetConditions.length
    ? await database
        .select({ id: assignments.id, maxScore: assignments.maxScore })
        .from(assignments)
        .where(
          and(eq(assignments.requiresSubmission, true), or(...targetConditions)),
        )
    : [];
  const assignedHomework = hwRows.length;
  const maxById = new Map(hwRows.map((r) => [r.id, r.maxScore ?? 100]));

  const subs = hwRows.length
    ? await database
        .select({
          assignmentId: assignmentSubmissions.assignmentId,
          status: assignmentSubmissions.status,
          score: assignmentSubmissions.score,
          submittedAt: assignmentSubmissions.submittedAt,
        })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.studentProfileId, profile.id),
            inArray(
              assignmentSubmissions.assignmentId,
              hwRows.map((r) => r.id),
            ),
          ),
        )
    : [];
  const submitted = subs.length;
  const graded = subs.filter((s) => s.status === 'graded' && s.score != null);

  // Attendance with lesson dates (chronological).
  const att = await database
    .select({
      status: lessonAttendanceRecords.status,
      startsAt: lessonSessions.startsAt,
    })
    .from(lessonAttendanceRecords)
    .innerJoin(
      lessonSessions,
      eq(lessonSessions.id, lessonAttendanceRecords.lessonSessionId),
    )
    .where(eq(lessonAttendanceRecords.studentProfileId, profile.id))
    .orderBy(asc(lessonSessions.startsAt));
  const present = att.filter((a) => a.status === 'present').length;
  const late = att.filter((a) => a.status === 'late').length;
  const absent = att.filter((a) => a.status === 'absent').length;
  // Excused + needs_review/pending are excluded from the rate (no penalty).
  const counted = present + late + absent;
  const attended = present + late;

  const gradeRatio = (assignmentId: string, score: number) =>
    score / (maxById.get(assignmentId) ?? 100);

  const completionPercent = assignedHomework
    ? Math.round((submitted / assignedHomework) * 100)
    : 0;
  const gradePercent = graded.length
    ? Math.round(
        (graded.reduce(
          (sum, g) => sum + gradeRatio(g.assignmentId, g.score as number),
          0,
        ) /
          graded.length) *
          100,
      )
    : 0;
  const attendancePercent = counted
    ? Math.round((attended / counted) * 100)
    : 0;

  const developmentScore = Math.round(
    WEIGHTS.grade * gradePercent +
      WEIGHTS.completion * completionPercent +
      WEIGHTS.attendance * attendancePercent,
  );

  let xp = present * XP.present + late * XP.late + submitted * XP.submit;
  for (const g of graded) {
    xp += Math.round(gradeRatio(g.assignmentId, g.score as number) * XP.gradeMax);
  }

  // Current attendance streak: consecutive most-recent lessons attended;
  // absent breaks it, excused/unconfirmed are neutral (skipped).
  let streak = 0;
  for (let i = att.length - 1; i >= 0; i -= 1) {
    const s = att[i].status;
    if (s === 'present' || s === 'late') streak += 1;
    else if (s === 'absent') break;
    // excused / needs_review / pending → skip without breaking
  }

  const gradeTrend = graded
    .slice()
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .map((g) => ({
      date: g.submittedAt.toISOString(),
      percent: Math.round(gradeRatio(g.assignmentId, g.score as number) * 100),
    }));

  const improving =
    gradeTrend.length >= 2 &&
    gradeTrend[gradeTrend.length - 1].percent > gradeTrend[0].percent;
  const perfect = graded.some(
    (g) => g.score === (maxById.get(g.assignmentId) ?? 100),
  );

  const badges: ProgressBadge[] = [
    { key: 'first_assignment', earned: submitted >= 1 },
    { key: 'ten_lessons', earned: attended >= 10 },
    { key: 'perfect_score', earned: perfect },
    { key: 'high_average', earned: gradePercent >= 85 },
    { key: 'streak_4', earned: streak >= 4 },
    { key: 'improving', earned: improving },
  ];

  const idx = CEFR.indexOf(level as (typeof CEFR)[number]);
  const next = idx >= 0 && idx < CEFR.length - 1 ? CEFR[idx + 1] : undefined;

  return {
    hasData: assignedHomework > 0 || counted > 0,
    level: {
      current: level,
      next,
      masteryPercent: developmentScore,
      readyToAdvance: next != null && developmentScore >= READY_THRESHOLD,
    },
    developmentScore,
    xp,
    streak,
    breakdown: { completionPercent, gradePercent, attendancePercent },
    counts: {
      assignedHomework,
      submitted,
      graded: graded.length,
      attended,
      lessons: counted,
    },
    badges,
    gradeTrend,
  };
}
