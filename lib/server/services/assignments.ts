import 'server-only';

import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  assignmentAttachments,
  assignments,
  assignmentSubmissionAttachments,
  assignmentSubmissions,
  contacts,
  enrollments,
  instructorProfiles,
  lessonSessions,
  mediaAssets,
  programBranches,
  studentProfiles,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import {
  notifyAssignmentAssigned,
  notifyAssignmentGraded,
  notifyAssignmentSubmitted,
} from './notify-events';

const DEFAULT_MAX_SCORE = 100;
const activeEnrollmentStatuses = ['active', 'paused'] as const;

export type AssignmentTarget =
  | { type: 'branch'; branchId: string }
  | { type: 'student'; enrollmentId: string };

export type CreateAssignmentInput = {
  title: string;
  description?: string | null;
  requiresSubmission: boolean;
  maxScore?: number | null;
  dueAt?: string | null;
  target: AssignmentTarget;
  lessonSessionId?: string | null;
  attachmentMediaIds?: string[];
};

export type AttachmentView = {
  mediaAssetId: string;
  name: string;
  kind: 'image' | 'video' | 'document' | 'audio';
  sizeBytes?: number;
};

export type InstructorAssignmentListItem = {
  id: string;
  title: string;
  requiresSubmission: boolean;
  maxScore?: number;
  dueAt?: string;
  createdAt: string;
  targetType: 'branch' | 'student';
  targetLabel: string;
  expectedCount: number;
  submittedCount: number;
  gradedCount: number;
};

export type SubmissionView = {
  id: string;
  body?: string;
  status: 'submitted' | 'graded';
  isLate: boolean;
  submittedAt: string;
  score?: number;
  feedback?: string;
  gradedAt?: string;
  attachments: AttachmentView[];
};

// A lesson an assignment is linked to (optional). The client formats startsAt
// into a locale-aware label.
export type LinkedLessonView = {
  id: string;
  startsAt: string;
};

export type AssignmentDetail = {
  id: string;
  title: string;
  description?: string;
  requiresSubmission: boolean;
  maxScore?: number;
  dueAt?: string;
  createdAt: string;
  targetType: 'branch' | 'student';
  targetLabel: string;
  attachments: AttachmentView[];
  lesson?: LinkedLessonView;
};

// A lesson the teacher may link a new assignment to. Client filters by the
// selected target (branchId for a branch target, enrollmentId for a student).
export type AssignableLesson = {
  id: string;
  startsAt: string;
  branchId: string | null;
  enrollmentId: string | null;
};

// An assignment shown on a lesson's detail page (reverse link).
export type LessonAssignmentItem = {
  id: string;
  title: string;
  requiresSubmission: boolean;
  dueAt?: string;
};

export type GradingRosterRow = {
  studentProfileId: string;
  studentName: string;
  enrollmentId: string;
  submission?: SubmissionView;
};

export type AssignmentForGrading = {
  assignment: AssignmentDetail;
  roster: GradingRosterRow[];
};

export type StudentAssignmentStatus =
  | 'material'
  | 'not_submitted'
  | 'submitted'
  | 'graded';

export type StudentAssignmentListItem = {
  id: string;
  title: string;
  requiresSubmission: boolean;
  maxScore?: number;
  dueAt?: string;
  createdAt: string;
  instructorName: string;
  status: StudentAssignmentStatus;
  score?: number;
  isLate?: boolean;
};

export type StudentAssignmentDetail = AssignmentDetail & {
  instructorName: string;
  status: StudentAssignmentStatus;
  submission?: SubmissionView;
};

// ---------------------------------------------------------------------------
// principal → profile resolution
// ---------------------------------------------------------------------------

function assertTeacher(principal: WorkspacePrincipal) {
  if (principal.role !== 'teacher') {
    throw new AuthorizationDeniedError('Teacher access is required.');
  }
}

function assertStudent(principal: WorkspacePrincipal) {
  if (principal.role !== 'student') {
    throw new AuthorizationDeniedError('Student access is required.');
  }
}

async function requireInstructorProfileId(
  principal: WorkspacePrincipal,
): Promise<string> {
  assertTeacher(principal);
  const [profile] = await database
    .select({ id: instructorProfiles.id })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.userId, principal.id))
    .limit(1);
  if (!profile) {
    throw new AuthorizationDeniedError('Instructor profile not found.');
  }
  return profile.id;
}

async function requireStudentProfileId(
  principal: WorkspacePrincipal,
): Promise<string> {
  assertStudent(principal);
  const [profile] = await database
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, principal.id))
    .limit(1);
  if (!profile) {
    throw new AuthorizationDeniedError('Student profile not found.');
  }
  return profile.id;
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function toNumber(value: number | string | null): number | undefined {
  return value == null ? undefined : Number(value);
}

// ---------------------------------------------------------------------------
// attachments
// ---------------------------------------------------------------------------

async function assertMediaOwnedAndReady(
  mediaIds: string[],
  ownerUserId: string,
) {
  if (!mediaIds.length) return;
  const rows = await database
    .select({
      id: mediaAssets.id,
      owner: mediaAssets.ownerUserId,
      status: mediaAssets.status,
    })
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, mediaIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of mediaIds) {
    const row = byId.get(id);
    if (!row || row.owner !== ownerUserId) {
      throw new PublicFlowError('attachment_forbidden', 403);
    }
    if (row.status !== 'ready') {
      throw new PublicFlowError('attachment_not_ready', 409);
    }
  }
}

async function loadAttachmentsByOwner(
  table: typeof assignmentAttachments | typeof assignmentSubmissionAttachments,
  ownerColumn:
    | typeof assignmentAttachments.assignmentId
    | typeof assignmentSubmissionAttachments.submissionId,
  ownerIds: string[],
): Promise<Map<string, AttachmentView[]>> {
  const result = new Map<string, AttachmentView[]>();
  if (!ownerIds.length) return result;
  const mediaIdColumn =
    table === assignmentAttachments
      ? assignmentAttachments.mediaAssetId
      : assignmentSubmissionAttachments.mediaAssetId;
  const rows = await database
    .select({
      ownerId: ownerColumn,
      mediaAssetId: mediaAssets.id,
      name: mediaAssets.originalName,
      kind: mediaAssets.kind,
      sizeBytes: mediaAssets.sizeBytes,
    })
    .from(table)
    .innerJoin(mediaAssets, eq(mediaAssets.id, mediaIdColumn))
    .where(inArray(ownerColumn, ownerIds));
  for (const row of rows) {
    const list = result.get(row.ownerId) ?? [];
    list.push({
      mediaAssetId: row.mediaAssetId,
      name: row.name,
      kind: row.kind,
      sizeBytes: toNumber(row.sizeBytes),
    });
    result.set(row.ownerId, list);
  }
  return result;
}

const loadAssignmentAttachments = (assignmentIds: string[]) =>
  loadAttachmentsByOwner(
    assignmentAttachments,
    assignmentAttachments.assignmentId,
    assignmentIds,
  );

const loadSubmissionAttachments = (submissionIds: string[]) =>
  loadAttachmentsByOwner(
    assignmentSubmissionAttachments,
    assignmentSubmissionAttachments.submissionId,
    submissionIds,
  );

// ---------------------------------------------------------------------------
// roster derivation (enrollment-based, like attendance)
// ---------------------------------------------------------------------------

type RosterEntry = {
  studentProfileId: string;
  studentName: string;
  enrollmentId: string;
};

async function getRosterForAssignment(assignment: {
  targetType: 'branch' | 'student';
  targetBranchId: string | null;
  targetEnrollmentId: string | null;
}): Promise<RosterEntry[]> {
  const conditions =
    assignment.targetType === 'branch'
      ? and(
          eq(enrollments.branchId, assignment.targetBranchId as string),
          inArray(enrollments.status, activeEnrollmentStatuses),
        )
      : eq(enrollments.id, assignment.targetEnrollmentId as string);

  const rows = await database
    .select({
      studentProfileId: studentProfiles.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      enrollmentId: enrollments.id,
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .where(conditions)
    .orderBy(asc(contacts.lastName), asc(contacts.firstName));

  // A student may appear once per matching enrollment; collapse by profile.
  const seen = new Set<string>();
  const roster: RosterEntry[] = [];
  for (const row of rows) {
    if (seen.has(row.studentProfileId)) continue;
    seen.add(row.studentProfileId);
    roster.push({
      studentProfileId: row.studentProfileId,
      studentName: fullName(row.firstName, row.lastName),
      enrollmentId: row.enrollmentId,
    });
  }
  return roster;
}

function mapSubmission(
  row: typeof assignmentSubmissions.$inferSelect,
  attachments: AttachmentView[],
): SubmissionView {
  return {
    id: row.id,
    body: row.body ?? undefined,
    status: row.status,
    isLate: row.isLate,
    submittedAt: row.submittedAt.toISOString(),
    score: row.score ?? undefined,
    feedback: row.feedback ?? undefined,
    gradedAt: row.gradedAt?.toISOString(),
    attachments,
  };
}

// ---------------------------------------------------------------------------
// teacher: create
// ---------------------------------------------------------------------------

export async function createAssignment(
  principal: WorkspacePrincipal,
  input: CreateAssignmentInput,
): Promise<{ id: string }> {
  const instructorProfileId = await requireInstructorProfileId(principal);

  const title = input.title.trim();
  if (!title) {
    throw new PublicFlowError('assignment_title_required', 400);
  }

  // Verify the teacher owns the target (branch they teach, or an enrollment of
  // theirs — group or private).
  let targetBranchId: string | null = null;
  let targetEnrollmentId: string | null = null;
  if (input.target.type === 'branch') {
    const [branch] = await database
      .select({ id: programBranches.id })
      .from(programBranches)
      .where(
        and(
          eq(programBranches.id, input.target.branchId),
          eq(programBranches.instructorProfileId, instructorProfileId),
        ),
      )
      .limit(1);
    if (!branch) throw new PublicFlowError('assignment_target_forbidden', 403);
    targetBranchId = branch.id;
  } else {
    const [enrollment] = await database
      .select({ id: enrollments.id })
      .from(enrollments)
      .leftJoin(
        programBranches,
        eq(programBranches.id, enrollments.branchId),
      )
      .where(
        and(
          eq(enrollments.id, input.target.enrollmentId),
          or(
            eq(enrollments.selectedInstructorProfileId, instructorProfileId),
            eq(programBranches.instructorProfileId, instructorProfileId),
          ),
        ),
      )
      .limit(1);
    if (!enrollment) {
      throw new PublicFlowError('assignment_target_forbidden', 403);
    }
    targetEnrollmentId = enrollment.id;
  }

  // A linked lesson (optional) must belong to the same target — which is already
  // verified to be the teacher's, so this transitively enforces ownership.
  if (input.lessonSessionId) {
    const [lesson] = await database
      .select({ id: lessonSessions.id })
      .from(lessonSessions)
      .where(
        and(
          eq(lessonSessions.id, input.lessonSessionId),
          targetBranchId
            ? eq(lessonSessions.branchId, targetBranchId)
            : eq(lessonSessions.enrollmentId, targetEnrollmentId as string),
        ),
      )
      .limit(1);
    if (!lesson) {
      throw new PublicFlowError('assignment_lesson_invalid', 400);
    }
  }

  const attachmentMediaIds = input.attachmentMediaIds ?? [];
  await assertMediaOwnedAndReady(attachmentMediaIds, principal.id);

  const maxScore = input.requiresSubmission
    ? (input.maxScore ?? DEFAULT_MAX_SCORE)
    : null;
  if (maxScore != null && maxScore <= 0) {
    throw new PublicFlowError('assignment_max_score_invalid', 400);
  }

  const [created] = await database
    .insert(assignments)
    .values({
      instructorProfileId,
      title,
      description: input.description?.trim() || null,
      requiresSubmission: input.requiresSubmission,
      maxScore,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      targetType: input.target.type,
      targetBranchId,
      targetEnrollmentId,
      lessonSessionId: input.lessonSessionId ?? null,
      createdByUserId: principal.id,
    })
    .returning({ id: assignments.id });

  if (attachmentMediaIds.length) {
    await database
      .insert(assignmentAttachments)
      .values(
        attachmentMediaIds.map((mediaAssetId) => ({
          assignmentId: created.id,
          mediaAssetId,
        })),
      )
      .onConflictDoNothing();
  }

  await notifyAssignmentAssigned(created.id);
  return { id: created.id };
}

// Lessons the teacher may link a new assignment to. Returns all of the
// teacher's own lessons (branch + private); the client filters to the chosen
// target. Volume is low, so no time window is applied — newest first.
export async function listAssignableLessonsForInstructor(
  principal: WorkspacePrincipal,
): Promise<AssignableLesson[]> {
  const instructorProfileId = await requireInstructorProfileId(principal);
  const rows = await database
    .select({
      id: lessonSessions.id,
      startsAt: lessonSessions.startsAt,
      branchId: lessonSessions.branchId,
      enrollmentId: lessonSessions.enrollmentId,
    })
    .from(lessonSessions)
    .where(eq(lessonSessions.instructorProfileId, instructorProfileId))
    .orderBy(desc(lessonSessions.startsAt))
    .limit(500);
  return rows.map((row) => ({
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    branchId: row.branchId,
    enrollmentId: row.enrollmentId,
  }));
}

// Assignments linked to a given lesson (reverse link on the lesson detail),
// scoped to the requesting teacher.
export async function listAssignmentsForLesson(
  principal: WorkspacePrincipal,
  lessonSessionId: string,
): Promise<LessonAssignmentItem[]> {
  const instructorProfileId = await requireInstructorProfileId(principal);
  const rows = await database
    .select({
      id: assignments.id,
      title: assignments.title,
      requiresSubmission: assignments.requiresSubmission,
      dueAt: assignments.dueAt,
    })
    .from(assignments)
    .where(
      and(
        eq(assignments.lessonSessionId, lessonSessionId),
        eq(assignments.instructorProfileId, instructorProfileId),
      ),
    )
    .orderBy(desc(assignments.createdAt));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    requiresSubmission: row.requiresSubmission,
    dueAt: row.dueAt?.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// teacher: list + grading view
// ---------------------------------------------------------------------------

export async function listInstructorAssignments(
  principal: WorkspacePrincipal,
): Promise<InstructorAssignmentListItem[]> {
  const instructorProfileId = await requireInstructorProfileId(principal);

  const rows = await database
    .select({
      id: assignments.id,
      title: assignments.title,
      requiresSubmission: assignments.requiresSubmission,
      maxScore: assignments.maxScore,
      dueAt: assignments.dueAt,
      createdAt: assignments.createdAt,
      targetType: assignments.targetType,
      targetBranchId: assignments.targetBranchId,
      targetEnrollmentId: assignments.targetEnrollmentId,
      branchName: programBranches.name,
    })
    .from(assignments)
    .leftJoin(
      programBranches,
      eq(programBranches.id, assignments.targetBranchId),
    )
    .where(eq(assignments.instructorProfileId, instructorProfileId))
    .orderBy(desc(assignments.createdAt));

  if (!rows.length) return [];

  const assignmentIds = rows.map((row) => row.id);
  const branchIds = rows
    .filter((row) => row.targetType === 'branch' && row.targetBranchId)
    .map((row) => row.targetBranchId as string);
  const enrollmentIds = rows
    .filter((row) => row.targetType === 'student' && row.targetEnrollmentId)
    .map((row) => row.targetEnrollmentId as string);

  // Submission tallies per assignment.
  const submissionRows = await database
    .select({
      assignmentId: assignmentSubmissions.assignmentId,
      status: assignmentSubmissions.status,
    })
    .from(assignmentSubmissions)
    .where(inArray(assignmentSubmissions.assignmentId, assignmentIds));
  const submitted = new Map<string, number>();
  const graded = new Map<string, number>();
  for (const row of submissionRows) {
    submitted.set(row.assignmentId, (submitted.get(row.assignmentId) ?? 0) + 1);
    if (row.status === 'graded') {
      graded.set(row.assignmentId, (graded.get(row.assignmentId) ?? 0) + 1);
    }
  }

  // Expected counts: branch roster sizes (active enrollments) + student labels.
  const branchCounts = new Map<string, number>();
  if (branchIds.length) {
    const enrollmentRows = await database
      .select({ branchId: enrollments.branchId })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.branchId, branchIds),
          inArray(enrollments.status, activeEnrollmentStatuses),
        ),
      );
    for (const row of enrollmentRows) {
      if (!row.branchId) continue;
      branchCounts.set(row.branchId, (branchCounts.get(row.branchId) ?? 0) + 1);
    }
  }

  const studentLabels = new Map<string, string>();
  if (enrollmentIds.length) {
    const studentRows = await database
      .select({
        enrollmentId: enrollments.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(inArray(enrollments.id, enrollmentIds));
    for (const row of studentRows) {
      studentLabels.set(row.enrollmentId, fullName(row.firstName, row.lastName));
    }
  }

  return rows.map((row) => {
    const targetLabel =
      row.targetType === 'branch'
        ? (row.branchName ?? '—')
        : (studentLabels.get(row.targetEnrollmentId ?? '') ?? '—');
    const expectedCount =
      row.targetType === 'branch'
        ? (branchCounts.get(row.targetBranchId ?? '') ?? 0)
        : 1;
    return {
      id: row.id,
      title: row.title,
      requiresSubmission: row.requiresSubmission,
      maxScore: row.maxScore ?? undefined,
      dueAt: row.dueAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      targetType: row.targetType,
      targetLabel,
      expectedCount,
      submittedCount: submitted.get(row.id) ?? 0,
      gradedCount: graded.get(row.id) ?? 0,
    };
  });
}

async function requireOwnedAssignment(
  instructorProfileId: string,
  assignmentId: string,
) {
  const [row] = await database
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      requiresSubmission: assignments.requiresSubmission,
      maxScore: assignments.maxScore,
      dueAt: assignments.dueAt,
      createdAt: assignments.createdAt,
      targetType: assignments.targetType,
      targetBranchId: assignments.targetBranchId,
      targetEnrollmentId: assignments.targetEnrollmentId,
      branchName: programBranches.name,
      lessonSessionId: assignments.lessonSessionId,
      lessonStartsAt: lessonSessions.startsAt,
    })
    .from(assignments)
    .leftJoin(
      programBranches,
      eq(programBranches.id, assignments.targetBranchId),
    )
    .leftJoin(
      lessonSessions,
      eq(lessonSessions.id, assignments.lessonSessionId),
    )
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.instructorProfileId, instructorProfileId),
      ),
    )
    .limit(1);
  if (!row) throw new PublicFlowError('assignment_not_found', 404);
  return row;
}

export async function getAssignmentForGrading(
  principal: WorkspacePrincipal,
  assignmentId: string,
): Promise<AssignmentForGrading> {
  const instructorProfileId = await requireInstructorProfileId(principal);
  const assignment = await requireOwnedAssignment(
    instructorProfileId,
    assignmentId,
  );

  const [roster, submissionRows, assignmentAttachmentMap] = await Promise.all([
    getRosterForAssignment(assignment),
    database
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignmentId)),
    loadAssignmentAttachments([assignmentId]),
  ]);

  const submissionAttachmentMap = await loadSubmissionAttachments(
    submissionRows.map((row) => row.id),
  );
  const submissionByStudent = new Map(
    submissionRows.map((row) => [
      row.studentProfileId,
      mapSubmission(row, submissionAttachmentMap.get(row.id) ?? []),
    ]),
  );

  const targetLabel =
    assignment.targetType === 'branch'
      ? (assignment.branchName ?? '—')
      : (roster[0]?.studentName ?? '—');

  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description ?? undefined,
      requiresSubmission: assignment.requiresSubmission,
      maxScore: assignment.maxScore ?? undefined,
      dueAt: assignment.dueAt?.toISOString(),
      createdAt: assignment.createdAt.toISOString(),
      targetType: assignment.targetType,
      targetLabel,
      attachments: assignmentAttachmentMap.get(assignmentId) ?? [],
      lesson:
        assignment.lessonSessionId && assignment.lessonStartsAt
          ? {
              id: assignment.lessonSessionId,
              startsAt: assignment.lessonStartsAt.toISOString(),
            }
          : undefined,
    },
    roster: roster.map((entry) => ({
      ...entry,
      submission: submissionByStudent.get(entry.studentProfileId),
    })),
  };
}

// ---------------------------------------------------------------------------
// teacher: grade
// ---------------------------------------------------------------------------

export async function gradeSubmission(
  principal: WorkspacePrincipal,
  input: { submissionId: string; score: number; feedback?: string | null },
): Promise<void> {
  const instructorProfileId = await requireInstructorProfileId(principal);

  const [row] = await database
    .select({
      submissionId: assignmentSubmissions.id,
      maxScore: assignments.maxScore,
      requiresSubmission: assignments.requiresSubmission,
    })
    .from(assignmentSubmissions)
    .innerJoin(
      assignments,
      eq(assignments.id, assignmentSubmissions.assignmentId),
    )
    .where(
      and(
        eq(assignmentSubmissions.id, input.submissionId),
        eq(assignments.instructorProfileId, instructorProfileId),
      ),
    )
    .limit(1);
  if (!row) throw new PublicFlowError('submission_not_found', 404);

  if (!Number.isInteger(input.score) || input.score < 0) {
    throw new PublicFlowError('grade_score_invalid', 400);
  }
  if (row.maxScore != null && input.score > row.maxScore) {
    throw new PublicFlowError('grade_score_invalid', 400);
  }

  await database
    .update(assignmentSubmissions)
    .set({
      score: input.score,
      feedback: input.feedback?.trim() || null,
      status: 'graded',
      gradedAt: new Date(),
      gradedByUserId: principal.id,
      updatedAt: new Date(),
    })
    .where(eq(assignmentSubmissions.id, input.submissionId));

  await notifyAssignmentGraded(input.submissionId);
}

// ---------------------------------------------------------------------------
// student: list + detail + submit
// ---------------------------------------------------------------------------

async function loadStudentTargeting(studentProfileId: string) {
  const rows = await database
    .select({
      enrollmentId: enrollments.id,
      branchId: enrollments.branchId,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentProfileId),
        inArray(enrollments.status, activeEnrollmentStatuses),
      ),
    );
  return {
    branchIds: rows.map((row) => row.branchId).filter(Boolean) as string[],
    enrollmentIds: rows.map((row) => row.enrollmentId),
  };
}

function studentStatus(
  requiresSubmission: boolean,
  submission?: { status: 'submitted' | 'graded' },
): StudentAssignmentStatus {
  if (!requiresSubmission) return 'material';
  if (!submission) return 'not_submitted';
  return submission.status;
}

export async function listStudentAssignments(
  principal: WorkspacePrincipal,
): Promise<StudentAssignmentListItem[]> {
  const studentProfileId = await requireStudentProfileId(principal);
  const { branchIds, enrollmentIds } =
    await loadStudentTargeting(studentProfileId);

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
  if (!targetConditions.length) return [];

  const rows = await database
    .select({
      id: assignments.id,
      title: assignments.title,
      requiresSubmission: assignments.requiresSubmission,
      maxScore: assignments.maxScore,
      dueAt: assignments.dueAt,
      createdAt: assignments.createdAt,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
    })
    .from(assignments)
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, assignments.instructorProfileId),
    )
    .where(or(...targetConditions))
    .orderBy(desc(assignments.createdAt));

  if (!rows.length) return [];

  const submissionRows = await database
    .select({
      assignmentId: assignmentSubmissions.assignmentId,
      status: assignmentSubmissions.status,
      score: assignmentSubmissions.score,
      isLate: assignmentSubmissions.isLate,
    })
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.studentProfileId, studentProfileId),
        inArray(
          assignmentSubmissions.assignmentId,
          rows.map((row) => row.id),
        ),
      ),
    );
  const submissionByAssignment = new Map(
    submissionRows.map((row) => [row.assignmentId, row]),
  );

  return rows.map((row) => {
    const submission = submissionByAssignment.get(row.id);
    return {
      id: row.id,
      title: row.title,
      requiresSubmission: row.requiresSubmission,
      maxScore: row.maxScore ?? undefined,
      dueAt: row.dueAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      instructorName: fullName(row.instructorFirstName, row.instructorLastName),
      status: studentStatus(row.requiresSubmission, submission),
      score: submission?.score ?? undefined,
      isLate: submission?.isLate,
    };
  });
}

async function requireStudentTargetAssignment(
  studentProfileId: string,
  assignmentId: string,
) {
  const { branchIds, enrollmentIds } =
    await loadStudentTargeting(studentProfileId);

  const [row] = await database
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      requiresSubmission: assignments.requiresSubmission,
      maxScore: assignments.maxScore,
      dueAt: assignments.dueAt,
      createdAt: assignments.createdAt,
      targetType: assignments.targetType,
      targetBranchId: assignments.targetBranchId,
      targetEnrollmentId: assignments.targetEnrollmentId,
      branchName: programBranches.name,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      lessonSessionId: assignments.lessonSessionId,
      lessonStartsAt: lessonSessions.startsAt,
    })
    .from(assignments)
    .innerJoin(
      instructorProfiles,
      eq(instructorProfiles.id, assignments.instructorProfileId),
    )
    .leftJoin(
      programBranches,
      eq(programBranches.id, assignments.targetBranchId),
    )
    .leftJoin(
      lessonSessions,
      eq(lessonSessions.id, assignments.lessonSessionId),
    )
    .where(eq(assignments.id, assignmentId))
    .limit(1);
  if (!row) throw new PublicFlowError('assignment_not_found', 404);

  const isTarget =
    (row.targetType === 'branch' &&
      row.targetBranchId != null &&
      branchIds.includes(row.targetBranchId)) ||
    (row.targetType === 'student' &&
      row.targetEnrollmentId != null &&
      enrollmentIds.includes(row.targetEnrollmentId));
  if (!isTarget) throw new PublicFlowError('assignment_not_found', 404);

  return row;
}

export async function getStudentAssignment(
  principal: WorkspacePrincipal,
  assignmentId: string,
): Promise<StudentAssignmentDetail> {
  const studentProfileId = await requireStudentProfileId(principal);
  const assignment = await requireStudentTargetAssignment(
    studentProfileId,
    assignmentId,
  );

  const [assignmentAttachmentMap, submissionRow] = await Promise.all([
    loadAssignmentAttachments([assignmentId]),
    database
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.studentProfileId, studentProfileId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  let submission: SubmissionView | undefined;
  if (submissionRow) {
    const attachmentMap = await loadSubmissionAttachments([submissionRow.id]);
    submission = mapSubmission(
      submissionRow,
      attachmentMap.get(submissionRow.id) ?? [],
    );
  }

  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description ?? undefined,
    requiresSubmission: assignment.requiresSubmission,
    maxScore: assignment.maxScore ?? undefined,
    dueAt: assignment.dueAt?.toISOString(),
    createdAt: assignment.createdAt.toISOString(),
    targetType: assignment.targetType,
    targetLabel:
      assignment.targetType === 'branch'
        ? (assignment.branchName ?? '—')
        : fullName(assignment.instructorFirstName, assignment.instructorLastName),
    attachments: assignmentAttachmentMap.get(assignmentId) ?? [],
    lesson:
      assignment.lessonSessionId && assignment.lessonStartsAt
        ? {
            id: assignment.lessonSessionId,
            startsAt: assignment.lessonStartsAt.toISOString(),
          }
        : undefined,
    instructorName: fullName(
      assignment.instructorFirstName,
      assignment.instructorLastName,
    ),
    status: studentStatus(assignment.requiresSubmission, submission),
    submission,
  };
}

export async function submitAssignment(
  principal: WorkspacePrincipal,
  input: {
    assignmentId: string;
    body?: string | null;
    attachmentMediaIds?: string[];
  },
): Promise<void> {
  const studentProfileId = await requireStudentProfileId(principal);
  const assignment = await requireStudentTargetAssignment(
    studentProfileId,
    input.assignmentId,
  );

  if (!assignment.requiresSubmission) {
    throw new PublicFlowError('assignment_no_submission', 409);
  }

  const attachmentMediaIds = input.attachmentMediaIds ?? [];
  await assertMediaOwnedAndReady(attachmentMediaIds, principal.id);

  const body = input.body?.trim() || null;
  if (!body && !attachmentMediaIds.length) {
    throw new PublicFlowError('submission_empty', 400);
  }

  const [existing] = await database
    .select({
      id: assignmentSubmissions.id,
      status: assignmentSubmissions.status,
    })
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, input.assignmentId),
        eq(assignmentSubmissions.studentProfileId, studentProfileId),
      ),
    )
    .limit(1);

  if (existing && existing.status === 'graded') {
    throw new PublicFlowError('submission_locked', 409);
  }

  const now = new Date();
  const isLate = assignment.dueAt ? now > assignment.dueAt : false;

  let submissionId: string;
  if (existing) {
    submissionId = existing.id;
    await database
      .update(assignmentSubmissions)
      .set({ body, isLate, submittedAt: now, updatedAt: now })
      .where(eq(assignmentSubmissions.id, existing.id));
    await database
      .delete(assignmentSubmissionAttachments)
      .where(eq(assignmentSubmissionAttachments.submissionId, existing.id));
  } else {
    const [created] = await database
      .insert(assignmentSubmissions)
      .values({
        assignmentId: input.assignmentId,
        studentProfileId,
        body,
        status: 'submitted',
        isLate,
        submittedAt: now,
      })
      .returning({ id: assignmentSubmissions.id });
    submissionId = created.id;
  }

  if (attachmentMediaIds.length) {
    await database
      .insert(assignmentSubmissionAttachments)
      .values(
        attachmentMediaIds.map((mediaAssetId) => ({
          submissionId,
          mediaAssetId,
        })),
      )
      .onConflictDoNothing();
  }

  await notifyAssignmentSubmitted(submissionId);
}
