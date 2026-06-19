import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
} from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  branchLessonScheduleRules,
  contacts,
  enrollments,
  enrollmentBranchTransfers,
  enrollmentDrafts,
  instructorLanguageCompetencies,
  instructorProfiles,
  lessonSessions,
  privateLessonStudentRates,
  programBranches,
  programs,
  studentProfiles,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import {
  getBranchLessonScheduleMap,
  type BranchLessonScheduleView,
} from '@/lib/server/services/lesson-schedules';

export const PRIVATE_LESSON_PROGRAM_ID =
  '00000000-0000-4000-8000-000000000001';

export const supportedProgramLanguages = [
  'english',
  'german',
  'french',
  'arabic',
] as const;

export const supportedProgramLevels = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
] as const;

export type ProgramLanguage = (typeof supportedProgramLanguages)[number];
export type ProgramLevel = (typeof supportedProgramLevels)[number];
export type ProgramBranchStatus =
  | 'draft'
  | 'enrollment_open'
  | 'enrollment_closed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ProgramCatalogItem = {
  active: boolean;
  archivedAt?: string;
  canDelete: boolean;
  description?: string;
  id: string;
  kind: 'group' | 'private';
  language?: ProgramLanguage;
  levels: ProgramLevel[];
  listPriceCents?: number;
  name: string;
  systemKey?: string;
  systemManaged: boolean;
};

export type PrivateLessonRateView = {
  hourlyPriceCents: number;
  id: string;
  instructorName: string;
  instructorProfileId: string;
  language: ProgramLanguage;
};

export type ProgramBranchView = {
  archivedAt?: string;
  canDelete: boolean;
  currentEnrollmentCount: number;
  id: string;
  lessonSchedule?: BranchLessonScheduleView;
  maximumCapacity: number;
  minimumCapacity: number;
  name: string;
  notes?: string;
  plannedEndDate: string;
  plannedStartDate: string;
  programId: string;
  programName: string;
  status: ProgramBranchStatus;
  instructorName?: string;
  instructorProfileId?: string;
  timezone: string;
};

export type ProgramManagementData = {
  branches: ProgramBranchView[];
  instructors: Array<{ id: string; name: string }>;
  programs: ProgramCatalogItem[];
  rates: PrivateLessonRateView[];
};

export type BranchArchiveStudent = {
  enrollmentId: string;
  name: string;
  studentId: string;
};

export type BranchArchiveTarget = {
  currentEnrollmentCount: number;
  id: string;
  maximumCapacity: number;
  name: string;
};

export type BranchArchivePreview = {
  branchId: string;
  students: BranchArchiveStudent[];
  targets: BranchArchiveTarget[];
};

export type BranchTransferInput = {
  capacityOverride?: boolean;
  capacityOverrideNote?: string;
  enrollmentId: string;
  targetBranchId: string;
};

export type ProgramInput = {
  active: boolean;
  description?: string;
  language: ProgramLanguage;
  levels: ProgramLevel[];
  listPriceCents: number;
  name: string;
};

export type ProgramBranchInput = {
  instructorProfileId?: string;
  maximumCapacity: number;
  minimumCapacity: number;
  name: string;
  notes?: string;
  plannedEndDate: string;
  plannedStartDate: string;
  programId: string;
  status?: ProgramBranchStatus;
  timezone?: string;
};

export async function getProgramManagementData(
  principal: WorkspacePrincipal,
): Promise<ProgramManagementData> {
  assertAdmin(principal);

  const [programRows, branchRows, branchCounts, instructorRows, rateRows] =
    await Promise.all([
      database
        .select()
        .from(programs)
        .orderBy(asc(programs.kind), asc(programs.name)),
    database
      .select({
        archivedAt: programBranches.archivedAt,
        id: programBranches.id,
        maximumCapacity: programBranches.maximumCapacity,
        minimumCapacity: programBranches.minimumCapacity,
        name: programBranches.name,
        notes: programBranches.notes,
        plannedEndDate: programBranches.plannedEndDate,
        plannedStartDate: programBranches.plannedStartDate,
        programId: programBranches.programId,
        programName: programs.name,
        status: programBranches.status,
        instructorFirstName: instructorProfiles.firstName,
        instructorLastName: instructorProfiles.lastName,
        instructorProfileId: programBranches.instructorProfileId,
        timezone: programBranches.timezone,
      })
      .from(programBranches)
      .innerJoin(programs, eq(programs.id, programBranches.programId))
      .leftJoin(
        instructorProfiles,
        eq(instructorProfiles.id, programBranches.instructorProfileId),
      )
      .orderBy(
        desc(programBranches.plannedStartDate),
        asc(programBranches.name),
      ),
    database
      .select({
        branchId: enrollments.branchId,
        currentEnrollmentCount: count(),
      })
      .from(enrollments)
      .where(
        and(
          isNotNull(enrollments.branchId),
          inArray(enrollments.status, ['active', 'paused']),
        ),
      )
      .groupBy(enrollments.branchId),
    database
      .select({
        firstName: instructorProfiles.firstName,
        id: instructorProfiles.id,
        lastName: instructorProfiles.lastName,
      })
      .from(instructorProfiles)
      .where(
        eq(instructorProfiles.status, 'active'),
      )
      .orderBy(
        asc(instructorProfiles.lastName),
        asc(instructorProfiles.firstName),
      ),
    database
      .select({
        hourlyPriceCents: privateLessonStudentRates.hourlyPriceCents,
        id: privateLessonStudentRates.id,
        instructorFirstName: instructorProfiles.firstName,
        instructorLastName: instructorProfiles.lastName,
        instructorProfileId:
          privateLessonStudentRates.instructorProfileId,
        language: privateLessonStudentRates.language,
      })
      .from(privateLessonStudentRates)
      .innerJoin(
        instructorProfiles,
        eq(
          instructorProfiles.id,
          privateLessonStudentRates.instructorProfileId,
        ),
      )
      .innerJoin(
        instructorLanguageCompetencies,
        and(
          eq(
            instructorLanguageCompetencies.instructorId,
            privateLessonStudentRates.instructorProfileId,
          ),
          eq(
            instructorLanguageCompetencies.language,
            privateLessonStudentRates.language,
          ),
        ),
      )
      .where(
        and(
          eq(privateLessonStudentRates.active, true),
          isNull(privateLessonStudentRates.effectiveUntil),
          eq(instructorProfiles.status, 'active'),
        ),
      )
      .orderBy(
        asc(instructorProfiles.lastName),
        asc(instructorProfiles.firstName),
        asc(privateLessonStudentRates.language),
      ),
    ]);

  const [
    draftReferences,
    enrollmentReferences,
    transferFromReferences,
    transferToReferences,
  ] = await Promise.all([
    database
      .select({
        branchId: enrollmentDrafts.branchId,
        programId: enrollmentDrafts.programId,
      })
      .from(enrollmentDrafts),
    database
      .select({
        branchId: enrollments.branchId,
        programId: enrollments.programId,
      })
      .from(enrollments),
    database
      .select({ branchId: enrollmentBranchTransfers.fromBranchId })
      .from(enrollmentBranchTransfers),
    database
      .select({ branchId: enrollmentBranchTransfers.toBranchId })
      .from(enrollmentBranchTransfers),
  ]);
  const usedBranchIds = new Set(
    [
      ...draftReferences.map((row) => row.branchId),
      ...enrollmentReferences.map((row) => row.branchId),
      ...transferFromReferences.map((row) => row.branchId),
      ...transferToReferences.map((row) => row.branchId),
    ].filter((value): value is string => Boolean(value)),
  );
  const usedProgramIds = new Set(
    [
      ...draftReferences.map((row) => row.programId),
      ...enrollmentReferences.map((row) => row.programId),
      ...branchRows.map((row) => row.programId),
    ].filter((value): value is string => Boolean(value)),
  );

  const countByBranch = new Map(
    branchCounts
      .filter(
        (
          item,
        ): item is typeof item & {
          branchId: string;
        } => Boolean(item.branchId),
      )
      .map((item) => [item.branchId, Number(item.currentEnrollmentCount)]),
  );
  const lessonScheduleByBranch = await getBranchLessonScheduleMap(
    branchRows.map((branch) => branch.id),
  );

  return {
    branches: branchRows.map((branch) => ({
      archivedAt: branch.archivedAt?.toISOString(),
      canDelete:
        !usedBranchIds.has(branch.id) &&
        !lessonScheduleByBranch.has(branch.id),
      currentEnrollmentCount: countByBranch.get(branch.id) ?? 0,
      id: branch.id,
      lessonSchedule: lessonScheduleByBranch.get(branch.id),
      maximumCapacity: branch.maximumCapacity,
      minimumCapacity: branch.minimumCapacity,
      name: branch.name,
      notes: branch.notes ?? undefined,
      plannedEndDate: branch.plannedEndDate,
      plannedStartDate: branch.plannedStartDate,
      programId: branch.programId,
      programName: branch.programName,
      status: branch.status,
      instructorName:
        branch.instructorFirstName && branch.instructorLastName
          ? fullName(
              branch.instructorFirstName,
              branch.instructorLastName,
            )
          : undefined,
      instructorProfileId: branch.instructorProfileId ?? undefined,
      timezone: branch.timezone,
    })),
    instructors: instructorRows.map((instructor) => ({
      id: instructor.id,
      name: fullName(instructor.firstName, instructor.lastName),
    })),
    programs: programRows.map((program) => ({
      ...mapProgram(program),
      canDelete:
        !program.systemManaged && !usedProgramIds.has(program.id),
    })),
    rates: rateRows.map((rate) => ({
      hourlyPriceCents: rate.hourlyPriceCents,
      id: rate.id,
      instructorName: fullName(
        rate.instructorFirstName,
        rate.instructorLastName,
      ),
      instructorProfileId: rate.instructorProfileId,
      language: rate.language as ProgramLanguage,
    })),
  };
}

export async function getEnrollmentProgramCatalog(
  principal: WorkspacePrincipal,
): Promise<ProgramManagementData> {
  const data = await getProgramManagementData(principal);
  return {
    ...data,
    branches: data.branches.filter(
      (branch) =>
        !branch.archivedAt && branch.status === 'enrollment_open',
    ),
    programs: data.programs.filter(
      (program) => program.active && !program.archivedAt,
    ),
  };
}

export async function createProgram(
  principal: WorkspacePrincipal,
  input: ProgramInput,
) {
  assertAdmin(principal);
  validateProgramInput(input);

  const [program] = await database
    .insert(programs)
    .values({
      active: input.active,
      createdByUserId: principal.id,
      description: cleanOptional(input.description),
      kind: 'group',
      language: input.language,
      levels: uniqueLevels(input.levels),
      listPriceCents: input.listPriceCents,
      name: clean(input.name),
    })
    .returning({ id: programs.id });

  return program;
}

export async function updateProgram(
  principal: WorkspacePrincipal,
  programId: string,
  input: ProgramInput,
) {
  assertAdmin(principal);

  const [existing] = await database
    .select({
      archivedAt: programs.archivedAt,
      id: programs.id,
      systemManaged: programs.systemManaged,
    })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);

  if (!existing) {
    throw new PublicFlowError('program_not_found', 404);
  }
  if (existing.archivedAt) {
    throw new PublicFlowError('program_archived', 409);
  }

  if (existing.systemManaged) {
    await database
      .update(programs)
      .set({ active: input.active, updatedAt: new Date() })
      .where(eq(programs.id, programId));
    return { id: programId };
  }

  validateProgramInput(input);
  await database
    .update(programs)
    .set({
      active: input.active,
      description: cleanOptional(input.description),
      language: input.language,
      levels: uniqueLevels(input.levels),
      listPriceCents: input.listPriceCents,
      name: clean(input.name),
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));

  return { id: programId };
}

export async function createProgramBranch(
  principal: WorkspacePrincipal,
  input: ProgramBranchInput,
) {
  assertAdmin(principal);
  const values = await validateBranchInput(input);

  const [branch] = await database
    .insert(programBranches)
    .values({
      ...values,
      createdByUserId: principal.id,
    })
    .returning({ id: programBranches.id });

  return branch;
}

export async function updateProgramBranch(
  principal: WorkspacePrincipal,
  branchId: string,
  input: ProgramBranchInput,
) {
  assertAdmin(principal);
  const values = await validateBranchInput(input);

  return database.transaction(async (transaction) => {
    const [existing] = await transaction
      .select({
        archivedAt: programBranches.archivedAt,
        id: programBranches.id,
      })
      .from(programBranches)
      .where(eq(programBranches.id, branchId))
      .limit(1)
      .for('update');

    if (!existing) {
      throw new PublicFlowError('program_branch_not_found', 404);
    }
    if (existing.archivedAt) {
      throw new PublicFlowError('program_branch_archived', 409);
    }

    const [occupancy] = await transaction
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.branchId, branchId),
          inArray(enrollments.status, ['active', 'paused']),
        ),
      );
    if (Number(occupancy?.count ?? 0) > values.maximumCapacity) {
      throw new PublicFlowError('branch_capacity_below_occupancy', 409);
    }

    await transaction
      .update(programBranches)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(programBranches.id, branchId));

    return { id: branchId };
  });
}

export async function getProgramBranchArchivePreview(
  principal: WorkspacePrincipal,
  branchId: string,
): Promise<BranchArchivePreview> {
  assertAdmin(principal);

  const [branch] = await database
    .select({
      archivedAt: programBranches.archivedAt,
      id: programBranches.id,
      programId: programBranches.programId,
    })
    .from(programBranches)
    .where(eq(programBranches.id, branchId))
    .limit(1);
  if (!branch || branch.archivedAt) {
    throw new PublicFlowError('program_branch_not_found', 404);
  }

  const [students, targetRows, targetCounts] = await Promise.all([
    database
      .select({
        enrollmentId: enrollments.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        studentId: studentProfiles.id,
      })
      .from(enrollments)
      .innerJoin(
        studentProfiles,
        eq(studentProfiles.id, enrollments.studentId),
      )
      .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
      .where(
        and(
          eq(enrollments.branchId, branchId),
          inArray(enrollments.status, ['active', 'paused']),
        ),
      )
      .orderBy(asc(contacts.lastName), asc(contacts.firstName)),
    database
      .select({
        id: programBranches.id,
        maximumCapacity: programBranches.maximumCapacity,
        name: programBranches.name,
      })
      .from(programBranches)
      .where(
        and(
          eq(programBranches.programId, branch.programId),
          inArray(programBranches.status, [
            'enrollment_open',
            'in_progress',
          ]),
          isNull(programBranches.archivedAt),
        ),
      )
      .orderBy(asc(programBranches.name)),
    database
      .select({
        branchId: enrollments.branchId,
        currentEnrollmentCount: count(),
      })
      .from(enrollments)
      .where(
        and(
          isNotNull(enrollments.branchId),
          inArray(enrollments.status, ['active', 'paused']),
        ),
      )
      .groupBy(enrollments.branchId),
  ]);
  const counts = new Map(
    targetCounts
      .filter(
        (row): row is typeof row & { branchId: string } =>
          Boolean(row.branchId),
      )
      .map((row) => [row.branchId, Number(row.currentEnrollmentCount)]),
  );

  return {
    branchId,
    students: students.map((student) => ({
      enrollmentId: student.enrollmentId,
      name: fullName(student.firstName, student.lastName),
      studentId: student.studentId,
    })),
    targets: targetRows
      .filter((target) => target.id !== branchId)
      .map((target) => ({
        currentEnrollmentCount: counts.get(target.id) ?? 0,
        id: target.id,
        maximumCapacity: target.maximumCapacity,
        name: target.name,
      })),
  };
}

export async function archiveProgramBranch(
  principal: WorkspacePrincipal,
  branchId: string,
  input: {
    reason: string;
    transfers: BranchTransferInput[];
  },
) {
  assertAdmin(principal);
  const reason = clean(input.reason);
  if (reason.length < 3) {
    throw new PublicFlowError('branch_archive_reason_required', 400);
  }

  return database.transaction(async (transaction) => {
    const [source] = await transaction
      .select()
      .from(programBranches)
      .where(eq(programBranches.id, branchId))
      .limit(1)
      .for('update');
    if (!source || source.archivedAt) {
      throw new PublicFlowError('program_branch_not_found', 404);
    }

    const activeEnrollments = await transaction
      .select({
        id: enrollments.id,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.branchId, branchId),
          inArray(enrollments.status, ['active', 'paused']),
        ),
      )
      .for('update');
    const transferByEnrollment = new Map(
      input.transfers.map((transfer) => [transfer.enrollmentId, transfer]),
    );
    if (
      transferByEnrollment.size !== activeEnrollments.length ||
      activeEnrollments.some(
        (enrollment) => !transferByEnrollment.has(enrollment.id),
      )
    ) {
      throw new PublicFlowError('branch_transfers_incomplete', 409);
    }

    const targetIds = [...new Set(input.transfers.map((item) => item.targetBranchId))];
    const targets = targetIds.length
      ? await transaction
          .select()
          .from(programBranches)
          .where(inArray(programBranches.id, targetIds))
          .for('update')
      : [];
    const targetById = new Map(targets.map((target) => [target.id, target]));
    const targetCounts = new Map<string, number>();

    for (const targetId of targetIds) {
      const target = targetById.get(targetId);
      if (
        !target ||
        target.id === source.id ||
        target.programId !== source.programId ||
        target.archivedAt ||
        !['enrollment_open', 'in_progress'].includes(target.status)
      ) {
        throw new PublicFlowError('branch_transfer_target_invalid', 409);
      }
      const [occupancy] = await transaction
        .select({ count: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.branchId, targetId),
            inArray(enrollments.status, ['active', 'paused']),
          ),
        );
      targetCounts.set(targetId, Number(occupancy?.count ?? 0));
    }

    for (const enrollment of activeEnrollments) {
      const transfer = transferByEnrollment.get(enrollment.id)!;
      const target = targetById.get(transfer.targetBranchId)!;
      const nextCount = (targetCounts.get(target.id) ?? 0) + 1;
      const exceedsCapacity = nextCount > target.maximumCapacity;
      const overrideNote = cleanOptional(transfer.capacityOverrideNote);
      if (
        exceedsCapacity &&
        (!transfer.capacityOverride ||
          !overrideNote ||
          overrideNote.length < 3)
      ) {
        throw new PublicFlowError(
          'branch_transfer_capacity_override_required',
          409,
        );
      }

      const now = new Date();
      await transaction
        .update(enrollments)
        .set({
          branchId: target.id,
          capacityOverride: exceedsCapacity,
          capacityOverrideAt: exceedsCapacity ? now : null,
          capacityOverrideByUserId: exceedsCapacity ? principal.id : null,
          capacityOverrideNote: exceedsCapacity ? overrideNote : null,
          updatedAt: now,
        })
        .where(eq(enrollments.id, enrollment.id));
      await transaction.insert(enrollmentBranchTransfers).values({
        capacityOverride: exceedsCapacity,
        capacityOverrideNote: exceedsCapacity ? overrideNote : null,
        enrollmentId: enrollment.id,
        fromBranchId: source.id,
        reason,
        toBranchId: target.id,
        transferredByUserId: principal.id,
      });
      targetCounts.set(target.id, nextCount);
    }

    const now = new Date();
    const terminalStatus =
      source.plannedEndDate < dateOnly(now) ? 'completed' : 'cancelled';
    await transaction
      .update(programBranches)
      .set({
        archivedAt: now,
        status: terminalStatus,
        updatedAt: now,
      })
      .where(eq(programBranches.id, source.id));

    return {
      archivedAt: now.toISOString(),
      id: source.id,
      status: terminalStatus as ProgramBranchStatus,
      transferred: activeEnrollments.length,
    };
  });
}

export async function deleteUnusedProgramBranch(
  principal: WorkspacePrincipal,
  branchId: string,
) {
  assertAdmin(principal);
  const references = await Promise.all([
    database
      .select({ id: enrollmentDrafts.id })
      .from(enrollmentDrafts)
      .where(eq(enrollmentDrafts.branchId, branchId))
      .limit(1),
    database
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.branchId, branchId))
      .limit(1),
    database
      .select({ id: enrollmentBranchTransfers.id })
      .from(enrollmentBranchTransfers)
      .where(eq(enrollmentBranchTransfers.fromBranchId, branchId))
      .limit(1),
    database
      .select({ id: enrollmentBranchTransfers.id })
      .from(enrollmentBranchTransfers)
      .where(eq(enrollmentBranchTransfers.toBranchId, branchId))
      .limit(1),
    database
      .select({ id: branchLessonScheduleRules.id })
      .from(branchLessonScheduleRules)
      .where(eq(branchLessonScheduleRules.branchId, branchId))
      .limit(1),
    database
      .select({ id: lessonSessions.id })
      .from(lessonSessions)
      .where(eq(lessonSessions.branchId, branchId))
      .limit(1),
  ]);
  if (references.some((rows) => rows.length > 0)) {
    throw new PublicFlowError('program_branch_in_use', 409);
  }
  const [deleted] = await database
    .delete(programBranches)
    .where(eq(programBranches.id, branchId))
    .returning({ id: programBranches.id });
  if (!deleted) throw new PublicFlowError('program_branch_not_found', 404);
  return deleted;
}

export async function archiveProgram(
  principal: WorkspacePrincipal,
  programId: string,
) {
  assertAdmin(principal);
  const [program] = await database
    .select()
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  if (!program) throw new PublicFlowError('program_not_found', 404);
  if (program.systemManaged) {
    throw new PublicFlowError('system_program_lifecycle_locked', 409);
  }
  const branches = await database
    .select({ id: programBranches.id })
    .from(programBranches)
    .where(
      and(
        eq(programBranches.programId, programId),
        isNull(programBranches.archivedAt),
      ),
    )
    .limit(1);
  if (branches.length) {
    throw new PublicFlowError('program_has_unarchived_branches', 409);
  }
  const now = new Date();
  await database
    .update(programs)
    .set({ active: false, archivedAt: now, updatedAt: now })
    .where(eq(programs.id, programId));
  return { archivedAt: now.toISOString(), id: programId };
}

export async function deleteUnusedProgram(
  principal: WorkspacePrincipal,
  programId: string,
) {
  assertAdmin(principal);
  const [program] = await database
    .select({ systemManaged: programs.systemManaged })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  if (!program) throw new PublicFlowError('program_not_found', 404);
  if (program.systemManaged) {
    throw new PublicFlowError('system_program_lifecycle_locked', 409);
  }
  const references = await Promise.all([
    database
      .select({ id: programBranches.id })
      .from(programBranches)
      .where(eq(programBranches.programId, programId))
      .limit(1),
    database
      .select({ id: enrollmentDrafts.id })
      .from(enrollmentDrafts)
      .where(eq(enrollmentDrafts.programId, programId))
      .limit(1),
    database
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.programId, programId))
      .limit(1),
  ]);
  if (references.some((rows) => rows.length > 0)) {
    throw new PublicFlowError('program_in_use', 409);
  }
  await database.delete(programs).where(eq(programs.id, programId));
  return { id: programId };
}

export async function setPrivateLessonStudentRate(
  principal: WorkspacePrincipal,
  input: {
    hourlyPriceCents: number;
    instructorProfileId: string;
    language: ProgramLanguage;
  },
) {
  assertAdmin(principal);

  if (!Number.isInteger(input.hourlyPriceCents) || input.hourlyPriceCents <= 0) {
    throw new PublicFlowError('invalid_private_lesson_rate', 400);
  }

  return database.transaction(async (transaction) => {
    const [instructor] = await transaction
      .select({ id: instructorProfiles.id })
      .from(instructorProfiles)
      .where(
        and(
          eq(instructorProfiles.id, input.instructorProfileId),
          eq(instructorProfiles.status, 'active'),
        ),
      )
      .limit(1);

    if (!instructor) {
      throw new PublicFlowError('instructor_not_found', 404);
    }

    const [competency] = await transaction
      .select({ id: instructorLanguageCompetencies.id })
      .from(instructorLanguageCompetencies)
      .where(
        and(
          eq(
            instructorLanguageCompetencies.instructorId,
            input.instructorProfileId,
          ),
          eq(instructorLanguageCompetencies.language, input.language),
        ),
      )
      .limit(1);
    if (!competency) {
      throw new PublicFlowError('instructor_language_not_supported', 409);
    }

    const currentRates = await transaction
      .select({
        effectiveFrom: privateLessonStudentRates.effectiveFrom,
      })
      .from(privateLessonStudentRates)
      .where(
        and(
          eq(
            privateLessonStudentRates.instructorProfileId,
            input.instructorProfileId,
          ),
          eq(privateLessonStudentRates.language, input.language),
          eq(privateLessonStudentRates.active, true),
          isNull(privateLessonStudentRates.effectiveUntil),
        ),
      );
    const now = new Date();
    const effectiveFrom = new Date(
      Math.max(
        now.getTime(),
        ...currentRates.map((rate) => rate.effectiveFrom.getTime() + 1),
      ),
    );
    await transaction
      .update(privateLessonStudentRates)
      .set({
        active: false,
        effectiveUntil: effectiveFrom,
        updatedAt: effectiveFrom,
      })
      .where(
        and(
          eq(
            privateLessonStudentRates.instructorProfileId,
            input.instructorProfileId,
          ),
          eq(privateLessonStudentRates.language, input.language),
          eq(privateLessonStudentRates.active, true),
          isNull(privateLessonStudentRates.effectiveUntil),
        ),
      );

    const [rate] = await transaction
      .insert(privateLessonStudentRates)
      .values({
        createdByUserId: principal.id,
        effectiveFrom,
        hourlyPriceCents: input.hourlyPriceCents,
        instructorProfileId: input.instructorProfileId,
        language: input.language,
      })
      .returning({ id: privateLessonStudentRates.id });

    return rate;
  });
}

export async function resolveProgramPricing(
  transaction: Parameters<
    Parameters<typeof database.transaction>[0]
  >[0],
  input: {
    branchId?: string;
    capacityOverride?: boolean;
    privateLessonHours?: number;
    privateLessonLanguage?: ProgramLanguage;
    programId: string;
    instructorProfileId?: string;
  },
) {
  const [program] = await transaction
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, input.programId),
        eq(programs.active, true),
        isNull(programs.archivedAt),
      ),
    )
    .limit(1);

  if (!program) {
    throw new PublicFlowError('program_not_found', 404);
  }

  if (program.kind === 'group') {
    if (program.listPriceCents === null || !program.language) {
      throw new PublicFlowError('program_price_missing', 409);
    }

    if (!input.branchId) {
      throw new PublicFlowError('program_branch_required', 400);
    }

    const { atCapacity, branch, currentEnrollmentCount } =
      await resolveProgramBranchSelection(transaction, {
        branchId: input.branchId,
        capacityOverride: input.capacityOverride,
        programId: program.id,
      });

    return {
      atCapacity,
      basePriceCents: program.listPriceCents,
      branch: {
        ...branch,
        currentEnrollmentCount,
      },
      courseMode: 'group' as const,
      program,
      snapshot: {
        basePriceCents: program.listPriceCents,
        branchEndDate: branch.plannedEndDate,
        branchId: branch.id,
        branchMaximumCapacity: branch.maximumCapacity,
        branchName: branch.name,
        branchStartDate: branch.plannedStartDate,
        label: program.name,
        language: program.language,
        levels: program.levels,
        programId: program.id,
        type: 'group' as const,
      },
    };
  }

  if (
    !input.instructorProfileId ||
    !input.privateLessonLanguage ||
    !input.privateLessonHours ||
    input.privateLessonHours < 1
  ) {
    throw new PublicFlowError('private_lesson_selection_incomplete', 400);
  }

  const [rate] = await transaction
    .select({
      hourlyPriceCents: privateLessonStudentRates.hourlyPriceCents,
      id: privateLessonStudentRates.id,
      instructorFirstName: instructorProfiles.firstName,
      instructorLastName: instructorProfiles.lastName,
      instructorProfileId: privateLessonStudentRates.instructorProfileId,
    })
    .from(privateLessonStudentRates)
    .innerJoin(
      instructorProfiles,
      eq(
        instructorProfiles.id,
        privateLessonStudentRates.instructorProfileId,
      ),
    )
    .innerJoin(
      instructorLanguageCompetencies,
      and(
        eq(
          instructorLanguageCompetencies.instructorId,
          privateLessonStudentRates.instructorProfileId,
        ),
        eq(
          instructorLanguageCompetencies.language,
          privateLessonStudentRates.language,
        ),
      ),
    )
    .where(
      and(
        eq(
          privateLessonStudentRates.instructorProfileId,
          input.instructorProfileId,
        ),
        eq(privateLessonStudentRates.language, input.privateLessonLanguage),
        eq(privateLessonStudentRates.active, true),
        isNull(privateLessonStudentRates.effectiveUntil),
        eq(instructorProfiles.status, 'active'),
      ),
    )
    .orderBy(desc(privateLessonStudentRates.effectiveFrom))
    .limit(1);

  if (!rate) {
    throw new PublicFlowError('private_lesson_rate_not_found', 409);
  }

  const basePriceCents =
    rate.hourlyPriceCents * input.privateLessonHours;

  return {
    atCapacity: false,
    basePriceCents,
    courseMode: 'private' as const,
    program,
    rate,
    snapshot: {
      basePriceCents,
      hourlyStudentPriceCents: rate.hourlyPriceCents,
      label: program.name,
      language: input.privateLessonLanguage,
      privateLessonHours: input.privateLessonHours,
      privateLessonRateId: rate.id,
      programId: program.id,
      instructorProfileId: rate.instructorProfileId,
      teacherName: fullName(
        rate.instructorFirstName,
        rate.instructorLastName,
      ),
      type: 'private' as const,
    },
  };
}

export async function resolveProgramBranchSelection(
  transaction: Parameters<
    Parameters<typeof database.transaction>[0]
  >[0],
  input: {
    branchId: string;
    capacityOverride?: boolean;
    programId: string;
  },
) {
  const [branch] = await transaction
    .select()
    .from(programBranches)
    .where(
      and(
        eq(programBranches.id, input.branchId),
        eq(programBranches.programId, input.programId),
        eq(programBranches.status, 'enrollment_open'),
        isNull(programBranches.archivedAt),
      ),
    )
    .limit(1)
    .for('update');

  if (!branch) {
    throw new PublicFlowError('program_branch_not_available', 409);
  }

  const [occupancy] = await transaction
    .select({ count: count() })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.branchId, branch.id),
        inArray(enrollments.status, ['active', 'paused']),
      ),
    );
  const currentEnrollmentCount = Number(occupancy?.count ?? 0);
  const atCapacity = currentEnrollmentCount >= branch.maximumCapacity;

  if (atCapacity && !input.capacityOverride) {
    throw new PublicFlowError('program_branch_capacity_full', 409);
  }

  return { atCapacity, branch, currentEnrollmentCount };
}

async function validateBranchInput(input: ProgramBranchInput) {
  const name = clean(input.name);
  const notes = cleanOptional(input.notes);
  const timezone = clean(input.timezone || 'Europe/Istanbul');
  const start = parseDate(input.plannedStartDate);
  const end = parseDate(input.plannedEndDate);

  if (
    name.length < 2 ||
    !Number.isInteger(input.minimumCapacity) ||
    input.minimumCapacity < 1 ||
    !Number.isInteger(input.maximumCapacity) ||
    input.maximumCapacity < input.minimumCapacity ||
    end < start ||
    !timezone
  ) {
    throw new PublicFlowError('invalid_program_branch', 400);
  }

  const [program] = await database
    .select({
      archivedAt: programs.archivedAt,
      id: programs.id,
      kind: programs.kind,
      language: programs.language,
      levels: programs.levels,
    })
    .from(programs)
    .where(eq(programs.id, input.programId))
    .limit(1);

  if (!program || program.kind !== 'group' || program.archivedAt) {
    throw new PublicFlowError('group_program_not_found', 404);
  }

  if (input.instructorProfileId) {
    const [competency] = await database
      .select({
        levels: instructorLanguageCompetencies.levels,
        status: instructorProfiles.status,
      })
      .from(instructorLanguageCompetencies)
      .innerJoin(
        instructorProfiles,
        eq(
          instructorProfiles.id,
          instructorLanguageCompetencies.instructorId,
        ),
      )
      .where(
        and(
          eq(
            instructorLanguageCompetencies.instructorId,
            input.instructorProfileId,
          ),
          eq(
            instructorLanguageCompetencies.language,
            program.language ?? '',
          ),
        ),
      )
      .limit(1);
    const requiredLevels = program.levels as ProgramLevel[];
    if (
      !competency ||
      competency.status !== 'active' ||
      !requiredLevels.every((level) =>
        (competency.levels as string[]).includes(level),
      )
    ) {
      throw new PublicFlowError('instructor_program_mismatch', 409);
    }
  }

  return {
    instructorProfileId: input.instructorProfileId || null,
    maximumCapacity: input.maximumCapacity,
    minimumCapacity: input.minimumCapacity,
    name,
    notes,
    plannedEndDate: input.plannedEndDate,
    plannedStartDate: input.plannedStartDate,
    programId: input.programId,
    status: input.status ?? 'enrollment_open',
    timezone,
  };
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PublicFlowError('invalid_program_branch_date', 400);
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new PublicFlowError('invalid_program_branch_date', 400);
  }
  return parsed;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function mapProgram(row: typeof programs.$inferSelect): ProgramCatalogItem {
  return {
    active: row.active,
    archivedAt: row.archivedAt?.toISOString(),
    canDelete: false,
    description: row.description ?? undefined,
    id: row.id,
    kind: row.kind,
    language: row.language
      ? (row.language as ProgramLanguage)
      : undefined,
    levels: row.levels as ProgramLevel[],
    listPriceCents: row.listPriceCents ?? undefined,
    name: row.name,
    systemKey: row.systemKey ?? undefined,
    systemManaged: row.systemManaged,
  };
}

function validateProgramInput(input: ProgramInput) {
  if (
    clean(input.name).length < 2 ||
    !supportedProgramLanguages.includes(input.language) ||
    !Number.isInteger(input.listPriceCents) ||
    input.listPriceCents < 0 ||
    uniqueLevels(input.levels).length === 0
  ) {
    throw new PublicFlowError('invalid_program', 400);
  }
}

function uniqueLevels(levels: ProgramLevel[]) {
  return [...new Set(levels)].filter((level) =>
    supportedProgramLevels.includes(level),
  );
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function cleanOptional(value?: string) {
  const valueCleaned = value ? clean(value) : '';
  return valueCleaned || null;
}

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
