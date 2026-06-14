import 'server-only';

import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  privateLessonStudentRates,
  programs,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';

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

export type ProgramCatalogItem = {
  active: boolean;
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
  language: ProgramLanguage;
  teacherName: string;
  teacherUserId: string;
};

export type ProgramManagementData = {
  programs: ProgramCatalogItem[];
  rates: PrivateLessonRateView[];
  teachers: Array<{ id: string; name: string }>;
};

export type ProgramInput = {
  active: boolean;
  description?: string;
  language: ProgramLanguage;
  levels: ProgramLevel[];
  listPriceCents: number;
  name: string;
};

export async function getProgramManagementData(
  principal: WorkspacePrincipal,
): Promise<ProgramManagementData> {
  assertAdmin(principal);

  const [programRows, teacherRows, rateRows] = await Promise.all([
    database.select().from(programs).orderBy(asc(programs.kind), asc(programs.name)),
    database
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(
        and(eq(users.role, 'teacher'), eq(users.accountStatus, 'active')),
      )
      .orderBy(asc(users.name)),
    database
      .select({
        hourlyPriceCents: privateLessonStudentRates.hourlyPriceCents,
        id: privateLessonStudentRates.id,
        language: privateLessonStudentRates.language,
        teacherName: users.name,
        teacherUserId: privateLessonStudentRates.teacherUserId,
      })
      .from(privateLessonStudentRates)
      .innerJoin(users, eq(users.id, privateLessonStudentRates.teacherUserId))
      .where(
        and(
          eq(privateLessonStudentRates.active, true),
          isNull(privateLessonStudentRates.effectiveUntil),
        ),
      )
      .orderBy(asc(users.name), asc(privateLessonStudentRates.language)),
  ]);

  return {
    programs: programRows.map(mapProgram),
    rates: rateRows.map((rate) => ({
      ...rate,
      language: rate.language as ProgramLanguage,
    })),
    teachers: teacherRows,
  };
}

export async function getEnrollmentProgramCatalog(
  principal: WorkspacePrincipal,
): Promise<ProgramManagementData> {
  const data = await getProgramManagementData(principal);
  return {
    ...data,
    programs: data.programs.filter((program) => program.active),
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
    .select({ id: programs.id, systemManaged: programs.systemManaged })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);

  if (!existing) {
    throw new PublicFlowError('program_not_found', 404);
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

export async function setPrivateLessonStudentRate(
  principal: WorkspacePrincipal,
  input: {
    hourlyPriceCents: number;
    language: ProgramLanguage;
    teacherUserId: string;
  },
) {
  assertAdmin(principal);

  if (!Number.isInteger(input.hourlyPriceCents) || input.hourlyPriceCents <= 0) {
    throw new PublicFlowError('invalid_private_lesson_rate', 400);
  }

  return database.transaction(async (transaction) => {
    const [teacher] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, input.teacherUserId),
          eq(users.role, 'teacher'),
          eq(users.accountStatus, 'active'),
        ),
      )
      .limit(1);

    if (!teacher) {
      throw new PublicFlowError('teacher_not_found', 404);
    }

    const now = new Date();
    await transaction
      .update(privateLessonStudentRates)
      .set({
        active: false,
        effectiveUntil: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(privateLessonStudentRates.teacherUserId, input.teacherUserId),
          eq(privateLessonStudentRates.language, input.language),
          eq(privateLessonStudentRates.active, true),
          isNull(privateLessonStudentRates.effectiveUntil),
        ),
      );

    const [rate] = await transaction
      .insert(privateLessonStudentRates)
      .values({
        createdByUserId: principal.id,
        hourlyPriceCents: input.hourlyPriceCents,
        language: input.language,
        teacherUserId: input.teacherUserId,
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
    privateLessonHours?: number;
    privateLessonLanguage?: ProgramLanguage;
    programId: string;
    teacherUserId?: string;
  },
) {
  const [program] = await transaction
    .select()
    .from(programs)
    .where(and(eq(programs.id, input.programId), eq(programs.active, true)))
    .limit(1);

  if (!program) {
    throw new PublicFlowError('program_not_found', 404);
  }

  if (program.kind === 'group') {
    if (program.listPriceCents === null || !program.language) {
      throw new PublicFlowError('program_price_missing', 409);
    }

    return {
      basePriceCents: program.listPriceCents,
      courseMode: 'group' as const,
      program,
      snapshot: {
        basePriceCents: program.listPriceCents,
        label: program.name,
        language: program.language,
        levels: program.levels,
        programId: program.id,
        type: 'group' as const,
      },
    };
  }

  if (
    !input.teacherUserId ||
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
      teacherName: users.name,
      teacherUserId: privateLessonStudentRates.teacherUserId,
    })
    .from(privateLessonStudentRates)
    .innerJoin(users, eq(users.id, privateLessonStudentRates.teacherUserId))
    .where(
      and(
        eq(privateLessonStudentRates.teacherUserId, input.teacherUserId),
        eq(privateLessonStudentRates.language, input.privateLessonLanguage),
        eq(privateLessonStudentRates.active, true),
        isNull(privateLessonStudentRates.effectiveUntil),
        eq(users.role, 'teacher'),
        eq(users.accountStatus, 'active'),
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
      teacherName: rate.teacherName,
      teacherUserId: rate.teacherUserId,
      type: 'private' as const,
    },
  };
}

function mapProgram(row: typeof programs.$inferSelect): ProgramCatalogItem {
  return {
    active: row.active,
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
