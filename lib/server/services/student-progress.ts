import 'server-only';

import { and, asc, desc, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  assignments,
  assignmentSubmissions,
  contacts,
  enrollments,
  instructorProfiles,
  lessonAttendanceRecords,
  lessonSessions,
  programBranches,
  programs,
  studentProfiles,
  studentTeacherEvaluations,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';

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

// Batch development scores for the admin directory: same three components and
// weights as getStudentProgress, computed with grouped queries instead of one
// round-trip per student. Homework attribution is hybrid: active/paused
// enrollments count everything targeted at them (matching the student panel),
// while ended (completed/cancelled) enrollments count only assignments the
// student actually submitted — enrollments carry no end timestamp, and
// counting a still-running branch's newer homework against someone who left
// would silently erode their score over time.
export async function getDevelopmentScores(
  studentProfileIds: string[],
): Promise<Map<string, number>> {
  const ids = Array.from(new Set(studentProfileIds));
  const scores = new Map<string, number>();
  if (!ids.length) return scores;

  const enr = await database
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      branchId: enrollments.branchId,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(inArray(enrollments.studentId, ids));

  const isCurrent = (status: string) =>
    (activeEnrollmentStatuses as readonly string[]).includes(status);

  // Branches from ALL enrollments feed the homework fetch (so historical
  // submissions stay resolvable), but only current enrollments attribute
  // unsubmitted homework to a student.
  const branchIds = Array.from(
    new Set(
      enr.map((e) => e.branchId).filter((v): v is string => Boolean(v)),
    ),
  );
  const studentsByBranch = new Map<string, Set<string>>();
  for (const e of enr) {
    if (!e.branchId || !isCurrent(e.status)) continue;
    const set = studentsByBranch.get(e.branchId) ?? new Set<string>();
    set.add(e.studentId);
    studentsByBranch.set(e.branchId, set);
  }
  const studentByEnrollment = new Map(
    enr.filter((e) => isCurrent(e.status)).map((e) => [e.id, e.studentId]),
  );

  const targetConditions = [];
  if (branchIds.length) {
    targetConditions.push(
      and(
        eq(assignments.targetType, 'branch'),
        inArray(assignments.targetBranchId, branchIds),
      ),
    );
  }
  if (enr.length) {
    targetConditions.push(
      and(
        eq(assignments.targetType, 'student'),
        inArray(
          assignments.targetEnrollmentId,
          enr.map((e) => e.id),
        ),
      ),
    );
  }

  const hwRows = targetConditions.length
    ? await database
        .select({
          id: assignments.id,
          maxScore: assignments.maxScore,
          targetType: assignments.targetType,
          targetBranchId: assignments.targetBranchId,
          targetEnrollmentId: assignments.targetEnrollmentId,
        })
        .from(assignments)
        .where(
          and(eq(assignments.requiresSubmission, true), or(...targetConditions)),
        )
    : [];
  const maxById = new Map(hwRows.map((r) => [r.id, r.maxScore ?? 100]));

  const assignedByStudent = new Map<string, Set<string>>();
  const addAssigned = (studentId: string, assignmentId: string) => {
    const set = assignedByStudent.get(studentId) ?? new Set<string>();
    set.add(assignmentId);
    assignedByStudent.set(studentId, set);
  };
  for (const hw of hwRows) {
    if (hw.targetType === 'branch' && hw.targetBranchId) {
      for (const studentId of studentsByBranch.get(hw.targetBranchId) ?? []) {
        addAssigned(studentId, hw.id);
      }
    } else if (hw.targetEnrollmentId) {
      const studentId = studentByEnrollment.get(hw.targetEnrollmentId);
      if (studentId) addAssigned(studentId, hw.id);
    }
  }

  const subs = hwRows.length
    ? await database
        .select({
          studentProfileId: assignmentSubmissions.studentProfileId,
          assignmentId: assignmentSubmissions.assignmentId,
          status: assignmentSubmissions.status,
          score: assignmentSubmissions.score,
        })
        .from(assignmentSubmissions)
        .where(
          and(
            inArray(assignmentSubmissions.studentProfileId, ids),
            inArray(
              assignmentSubmissions.assignmentId,
              hwRows.map((r) => r.id),
            ),
          ),
        )
    : [];
  const subsByStudent = new Map<string, typeof subs>();
  for (const sub of subs) {
    const list = subsByStudent.get(sub.studentProfileId) ?? [];
    list.push(sub);
    subsByStudent.set(sub.studentProfileId, list);
  }

  const att = await database
    .select({
      studentProfileId: lessonAttendanceRecords.studentProfileId,
      status: lessonAttendanceRecords.status,
    })
    .from(lessonAttendanceRecords)
    .where(inArray(lessonAttendanceRecords.studentProfileId, ids));
  const attByStudent = new Map<string, typeof att>();
  for (const record of att) {
    const list = attByStudent.get(record.studentProfileId) ?? [];
    list.push(record);
    attByStudent.set(record.studentProfileId, list);
  }

  for (const studentId of ids) {
    // Assigned = homework targeted at current enrollments ∪ anything the
    // student ever submitted (historical participation from ended enrollments
    // counts as completed work, not as an open obligation).
    const assignedSet = new Set(assignedByStudent.get(studentId) ?? []);
    const mySubs = subsByStudent.get(studentId) ?? [];
    for (const sub of mySubs) assignedSet.add(sub.assignmentId);
    const assigned = assignedSet.size;
    const graded = mySubs.filter((s) => s.status === 'graded' && s.score != null);
    const myAtt = attByStudent.get(studentId) ?? [];
    const present = myAtt.filter((a) => a.status === 'present').length;
    const late = myAtt.filter((a) => a.status === 'late').length;
    const absent = myAtt.filter((a) => a.status === 'absent').length;
    const counted = present + late + absent;

    const completionPercent = assigned
      ? Math.round((Math.min(mySubs.length, assigned) / assigned) * 100)
      : 0;
    const gradePercent = graded.length
      ? Math.round(
          (graded.reduce(
            (sum, g) =>
              sum + (g.score as number) / (maxById.get(g.assignmentId) ?? 100),
            0,
          ) /
            graded.length) *
            100,
        )
      : 0;
    const attendancePercent = counted
      ? Math.round(((present + late) / counted) * 100)
      : 0;

    scores.set(
      studentId,
      Math.round(
        WEIGHTS.grade * gradePercent +
          WEIGHTS.completion * completionPercent +
          WEIGHTS.attendance * attendancePercent,
      ),
    );
  }

  return scores;
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
  // Only teacher-confirmed records count: auto-sync drafts (confirmedAt null)
  // may say 'absent' for a lesson whose sheet was never reviewed.
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
    .where(
      and(
        eq(lessonAttendanceRecords.studentProfileId, profile.id),
        isNotNull(lessonAttendanceRecords.confirmedAt),
      ),
    )
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

// ---------------------------------------------------------------------------
// Progress detail: the four parameters — attendance, lesson history,
// assignment grades and teacher evaluation notes. Shared by the student's own
// screen and the teacher's student detail (which shows nothing financial).
// ---------------------------------------------------------------------------

export type ProgressLessonView = {
  attendanceStatus:
    | 'present'
    | 'late'
    | 'absent'
    | 'excused'
    | 'unconfirmed'
    | null;
  id: string;
  startsAt: string;
  status: 'scheduled' | 'cancelled' | 'postponed' | 'completed';
  title: string;
};

export type ProgressGradeView = {
  assignmentTitle: string;
  gradedAt: string;
  maxScore: number;
  score: number;
};

export type ProgressEvaluationView = {
  note: string;
  teacherName: string;
  updatedAt: string;
};

export type ProgressDetail = {
  evaluations: ProgressEvaluationView[];
  grades: ProgressGradeView[];
  lessons: ProgressLessonView[];
};

const PROGRESS_HISTORY_LIMIT = 60;

async function loadProgressDetail(
  studentProfileId: string,
): Promise<ProgressDetail> {
  const now = new Date();

  const enr = await database
    .select({ branchId: enrollments.branchId, id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.studentId, studentProfileId));
  const branchIds = Array.from(
    new Set(enr.map((e) => e.branchId).filter((v): v is string => Boolean(v))),
  );

  const lessonConditions = [
    and(
      eq(lessonSessions.source, 'private'),
      eq(lessonSessions.studentProfileId, studentProfileId),
    ),
  ];
  if (branchIds.length) {
    lessonConditions.push(
      and(
        eq(lessonSessions.source, 'branch'),
        inArray(lessonSessions.branchId, branchIds),
      ),
    );
  }

  const [lessonRows, gradeRows, evaluationRows] = await Promise.all([
    database
      .select({
        attendanceConfirmedAt: lessonAttendanceRecords.confirmedAt,
        attendanceStatus: lessonAttendanceRecords.status,
        branchName: programBranches.name,
        id: lessonSessions.id,
        startsAt: lessonSessions.startsAt,
        status: lessonSessions.status,
      })
      .from(lessonSessions)
      .leftJoin(programBranches, eq(programBranches.id, lessonSessions.branchId))
      .leftJoin(
        lessonAttendanceRecords,
        and(
          eq(lessonAttendanceRecords.lessonSessionId, lessonSessions.id),
          eq(lessonAttendanceRecords.studentProfileId, studentProfileId),
        ),
      )
      .where(and(or(...lessonConditions), lt(lessonSessions.startsAt, now)))
      .orderBy(desc(lessonSessions.startsAt))
      .limit(PROGRESS_HISTORY_LIMIT),
    database
      .select({
        assignmentTitle: assignments.title,
        maxScore: assignments.maxScore,
        score: assignmentSubmissions.score,
        submittedAt: assignmentSubmissions.submittedAt,
      })
      .from(assignmentSubmissions)
      .innerJoin(
        assignments,
        eq(assignments.id, assignmentSubmissions.assignmentId),
      )
      .where(
        and(
          eq(assignmentSubmissions.studentProfileId, studentProfileId),
          eq(assignmentSubmissions.status, 'graded'),
          isNotNull(assignmentSubmissions.score),
        ),
      )
      .orderBy(desc(assignmentSubmissions.submittedAt))
      .limit(PROGRESS_HISTORY_LIMIT),
    database
      .select({
        firstName: instructorProfiles.firstName,
        lastName: instructorProfiles.lastName,
        note: studentTeacherEvaluations.note,
        updatedAt: studentTeacherEvaluations.updatedAt,
      })
      .from(studentTeacherEvaluations)
      .innerJoin(
        instructorProfiles,
        eq(instructorProfiles.id, studentTeacherEvaluations.instructorProfileId),
      )
      .where(eq(studentTeacherEvaluations.studentProfileId, studentProfileId))
      .orderBy(desc(studentTeacherEvaluations.updatedAt)),
  ]);

  return {
    evaluations: evaluationRows.map((row) => ({
      note: row.note,
      teacherName: `${row.firstName} ${row.lastName}`.trim(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    grades: gradeRows.map((row) => ({
      assignmentTitle: row.assignmentTitle,
      gradedAt: row.submittedAt.toISOString(),
      maxScore: row.maxScore ?? 100,
      score: row.score as number,
    })),
    lessons: lessonRows.map((row) => ({
      attendanceStatus:
        row.attendanceStatus == null
          ? null
          : row.attendanceConfirmedAt == null
            ? ('unconfirmed' as const)
            : row.attendanceStatus === 'pending' ||
                row.attendanceStatus === 'needs_review'
              ? ('unconfirmed' as const)
              : row.attendanceStatus,
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      status: row.status,
      title: row.branchName ?? '',
    })),
  };
}

/** The student's own four-parameter detail (attendance lives in lessons). */
export async function getStudentProgressDetail(
  principal: WorkspacePrincipal,
): Promise<ProgressDetail> {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }

  const [profile] = await database
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);
  if (!profile) return { evaluations: [], grades: [], lessons: [] };

  return loadProgressDetail(profile.id);
}

async function getTeacherProfileId(principal: WorkspacePrincipal) {
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Teacher access is required.');
  }
  const [profile] = await database
    .select({ id: instructorProfiles.id })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);
  if (!profile) {
    throw new PublicFlowError('instructor_profile_not_found', 404);
  }
  return profile.id;
}

// A teacher may open a student only while an active/paused enrollment ties
// them together — through their branch or a private-lesson assignment.
async function assertTeacherOfStudent(
  teacherProfileId: string,
  studentProfileId: string,
) {
  const [match] = await database
    .select({ id: enrollments.id })
    .from(enrollments)
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .where(
      and(
        eq(enrollments.studentId, studentProfileId),
        inArray(enrollments.status, activeEnrollmentStatuses),
        or(
          eq(programBranches.instructorProfileId, teacherProfileId),
          eq(enrollments.selectedInstructorProfileId, teacherProfileId),
        ),
      ),
    )
    .limit(1);

  if (!match) {
    throw new AuthorizationDeniedError('Student is not assigned to teacher.');
  }
}

export type TeacherStudentProgressView = {
  detail: ProgressDetail;
  developmentScore: number;
  myEvaluation: string | null;
  student: {
    branchName: string | null;
    courseMode: 'group' | 'private';
    currentLevel: string | null;
    email: string;
    enrolledAt: string;
    fullName: string;
    id: string;
    programName: string | null;
    status: string;
  };
};

// The teacher's student detail: identity + the four progress parameters and
// NOTHING else — pricing, discounts and balances are deliberately absent
// (they are admin/advisor-only).
export async function getTeacherStudentProgress(
  principal: WorkspacePrincipal,
  studentProfileId: string,
): Promise<TeacherStudentProgressView> {
  const teacherProfileId = await getTeacherProfileId(principal);
  await assertTeacherOfStudent(teacherProfileId, studentProfileId);

  const [studentRow] = await database
    .select({
      branchName: programBranches.name,
      courseMode: enrollments.courseMode,
      currentLevel: studentProfiles.currentLevel,
      email: contacts.email,
      enrolledAt: enrollments.enrolledAt,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      programName: programs.name,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .where(
      and(
        eq(enrollments.studentId, studentProfileId),
        inArray(enrollments.status, activeEnrollmentStatuses),
        or(
          eq(programBranches.instructorProfileId, teacherProfileId),
          eq(enrollments.selectedInstructorProfileId, teacherProfileId),
        ),
      ),
    )
    .orderBy(desc(enrollments.enrolledAt))
    .limit(1);

  if (!studentRow) {
    throw new PublicFlowError('student_profile_not_found', 404);
  }

  const [detail, scores, [evaluation]] = await Promise.all([
    loadProgressDetail(studentProfileId),
    getDevelopmentScores([studentProfileId]),
    database
      .select({ note: studentTeacherEvaluations.note })
      .from(studentTeacherEvaluations)
      .where(
        and(
          eq(studentTeacherEvaluations.studentProfileId, studentProfileId),
          eq(
            studentTeacherEvaluations.instructorProfileId,
            teacherProfileId,
          ),
        ),
      )
      .limit(1),
  ]);

  return {
    detail,
    developmentScore: scores.get(studentProfileId) ?? 0,
    myEvaluation: evaluation?.note ?? null,
    student: {
      branchName: studentRow.branchName,
      courseMode: studentRow.courseMode,
      currentLevel: studentRow.currentLevel,
      email: studentRow.email,
      enrolledAt: studentRow.enrolledAt.toISOString(),
      fullName: `${studentRow.firstName} ${studentRow.lastName}`.trim(),
      id: studentProfileId,
      programName: studentRow.programName,
      status: studentRow.status,
    },
  };
}

/** Upsert (or clear, with an empty note) the teacher's evaluation note. */
export async function saveTeacherEvaluation(
  principal: WorkspacePrincipal,
  studentProfileId: string,
  note: string,
) {
  const teacherProfileId = await getTeacherProfileId(principal);
  await assertTeacherOfStudent(teacherProfileId, studentProfileId);

  const cleaned = note.trim().slice(0, 2000);
  const now = new Date();

  if (!cleaned) {
    await database
      .delete(studentTeacherEvaluations)
      .where(
        and(
          eq(studentTeacherEvaluations.studentProfileId, studentProfileId),
          eq(
            studentTeacherEvaluations.instructorProfileId,
            teacherProfileId,
          ),
        ),
      );
    return { note: null };
  }

  await database
    .insert(studentTeacherEvaluations)
    .values({
      instructorProfileId: teacherProfileId,
      note: cleaned,
      studentProfileId,
    })
    .onConflictDoUpdate({
      target: [
        studentTeacherEvaluations.studentProfileId,
        studentTeacherEvaluations.instructorProfileId,
      ],
      set: { note: cleaned, updatedAt: now },
    });

  return { note: cleaned };
}
