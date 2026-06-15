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
import {
  normalizePhoneNumber,
  phoneNumberIsValid,
} from '@/lib/domain/phone';
import { appendUniqueTag } from '@/lib/domain/tags';
import { database } from '@/lib/server/db/client';
import {
  instructorAccountInvitations,
  instructorDocuments,
  instructorLanguageCompetencies,
  instructorProfiles,
  mediaAssets,
  privateLessonStudentRates,
  programBranches,
  programs,
  userInvitations,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import {
  supportedProgramLanguages,
  supportedProgramLevels,
  type ProgramLanguage,
  type ProgramLevel,
} from './programs';

export type InstructorStatus =
  | 'draft'
  | 'active'
  | 'on_leave'
  | 'inactive'
  | 'archived';

export type InstructorCompetency = {
  language: ProgramLanguage;
  levels: ProgramLevel[];
};

export type InstructorInput = {
  biography?: string;
  competencies: InstructorCompetency[];
  email: string;
  firstName: string;
  internalNotes?: string;
  lastName: string;
  phone: string;
  specialties: string[];
  status: InstructorStatus;
};

export type InstructorSummary = {
  accountStatus?: string;
  branchCount: number;
  competencies: InstructorCompetency[];
  email: string;
  firstName: string;
  fullName: string;
  id: string;
  lastName: string;
  phone: string;
  photoMediaAssetId?: string;
  privateLessonLanguages: ProgramLanguage[];
  status: InstructorStatus;
  userId?: string;
  username?: string;
};

export type InstructorDocumentView = {
  createdAt: string;
  id: string;
  kind: 'certificate' | 'identity' | 'contract' | 'other';
  label: string;
  mediaAssetId: string;
  notes?: string;
  originalName: string;
};

export type InstructorProfileView = InstructorSummary & {
  biography?: string;
  branches: Array<{
    id: string;
    name: string;
    programName: string;
    status: string;
  }>;
  documents: InstructorDocumentView[];
  internalNotes?: string;
  invitation?: {
    expiresAt: string;
    status: string;
    username: string;
  };
  specialties: string[];
};

export async function getInstructorDirectory(
  principal: WorkspacePrincipal,
): Promise<InstructorSummary[]> {
  assertAdmin(principal);

  const [profiles, competencies, branchCounts, rates] = await Promise.all([
    database
      .select({
        accountStatus: users.accountStatus,
        email: instructorProfiles.email,
        firstName: instructorProfiles.firstName,
        id: instructorProfiles.id,
        lastName: instructorProfiles.lastName,
        phone: instructorProfiles.phone,
        photoMediaAssetId: instructorProfiles.photoMediaAssetId,
        status: instructorProfiles.status,
        userId: instructorProfiles.userId,
        username: users.username,
      })
      .from(instructorProfiles)
      .leftJoin(users, eq(users.id, instructorProfiles.userId))
      .orderBy(
        asc(instructorProfiles.lastName),
        asc(instructorProfiles.firstName),
      ),
    database
      .select({
        instructorId: instructorLanguageCompetencies.instructorId,
        language: instructorLanguageCompetencies.language,
        levels: instructorLanguageCompetencies.levels,
      })
      .from(instructorLanguageCompetencies),
    database
      .select({
        count: count(),
        instructorId: programBranches.instructorProfileId,
      })
      .from(programBranches)
      .where(
        and(
          inArray(programBranches.status, [
            'draft',
            'enrollment_open',
            'enrollment_closed',
            'in_progress',
          ]),
          isNotNull(programBranches.instructorProfileId),
        ),
      )
      .groupBy(programBranches.instructorProfileId),
    database
      .select({
        instructorId: privateLessonStudentRates.instructorProfileId,
        language: privateLessonStudentRates.language,
      })
      .from(privateLessonStudentRates)
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
      .innerJoin(
        instructorProfiles,
        eq(
          instructorProfiles.id,
          privateLessonStudentRates.instructorProfileId,
        ),
      )
      .where(
        and(
          eq(privateLessonStudentRates.active, true),
          isNull(privateLessonStudentRates.effectiveUntil),
          eq(instructorProfiles.status, 'active'),
        ),
      ),
  ]);

  const competenciesByInstructor = groupCompetencies(competencies);
  const branchCountByInstructor = new Map(
    branchCounts
      .filter(
        (
          item,
        ): item is typeof item & { instructorId: string } =>
          Boolean(item.instructorId),
      )
      .map((item) => [item.instructorId, Number(item.count)]),
  );
  const privateLanguagesByInstructor = new Map<string, ProgramLanguage[]>();
  for (const rate of rates) {
    const language = rate.language as ProgramLanguage;
    const current = privateLanguagesByInstructor.get(rate.instructorId) ?? [];
    if (!current.includes(language)) current.push(language);
    privateLanguagesByInstructor.set(rate.instructorId, current);
  }

  return profiles.map((profile) => ({
    accountStatus: profile.accountStatus ?? undefined,
    branchCount: branchCountByInstructor.get(profile.id) ?? 0,
    competencies: competenciesByInstructor.get(profile.id) ?? [],
    email: profile.email,
    firstName: profile.firstName,
    fullName: fullName(profile.firstName, profile.lastName),
    id: profile.id,
    lastName: profile.lastName,
    phone: profile.phone,
    photoMediaAssetId: profile.photoMediaAssetId ?? undefined,
    privateLessonLanguages:
      privateLanguagesByInstructor.get(profile.id) ?? [],
    status: profile.status,
    userId: profile.userId ?? undefined,
    username: profile.username ?? undefined,
  }));
}

export async function getInstructorProfile(
  principal: WorkspacePrincipal,
  instructorId: string,
): Promise<InstructorProfileView | null> {
  assertAdmin(principal);

  const [profile] = await database
    .select({
      accountStatus: users.accountStatus,
      biography: instructorProfiles.biography,
      email: instructorProfiles.email,
      firstName: instructorProfiles.firstName,
      id: instructorProfiles.id,
      internalNotes: instructorProfiles.internalNotes,
      lastName: instructorProfiles.lastName,
      phone: instructorProfiles.phone,
      photoMediaAssetId: instructorProfiles.photoMediaAssetId,
      specialties: instructorProfiles.specialties,
      status: instructorProfiles.status,
      userId: instructorProfiles.userId,
      username: users.username,
    })
    .from(instructorProfiles)
    .leftJoin(users, eq(users.id, instructorProfiles.userId))
    .where(eq(instructorProfiles.id, instructorId))
    .limit(1);

  if (!profile) return null;

  const [competencies, branches, documents, rates, invitation] =
    await Promise.all([
      database
        .select({
          instructorId: instructorLanguageCompetencies.instructorId,
          language: instructorLanguageCompetencies.language,
          levels: instructorLanguageCompetencies.levels,
        })
        .from(instructorLanguageCompetencies)
        .where(eq(instructorLanguageCompetencies.instructorId, instructorId))
        .orderBy(asc(instructorLanguageCompetencies.language)),
      database
        .select({
          id: programBranches.id,
          name: programBranches.name,
          programName: programs.name,
          status: programBranches.status,
        })
        .from(programBranches)
        .innerJoin(programs, eq(programs.id, programBranches.programId))
        .where(eq(programBranches.instructorProfileId, instructorId))
        .orderBy(desc(programBranches.plannedStartDate)),
      database
        .select({
          createdAt: instructorDocuments.createdAt,
          id: instructorDocuments.id,
          kind: instructorDocuments.kind,
          label: instructorDocuments.label,
          mediaAssetId: instructorDocuments.mediaAssetId,
          notes: instructorDocuments.notes,
          originalName: mediaAssets.originalName,
        })
        .from(instructorDocuments)
        .innerJoin(
          mediaAssets,
          eq(mediaAssets.id, instructorDocuments.mediaAssetId),
        )
        .where(eq(instructorDocuments.instructorId, instructorId))
        .orderBy(desc(instructorDocuments.createdAt)),
      database
        .select({ language: privateLessonStudentRates.language })
        .from(privateLessonStudentRates)
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
            eq(privateLessonStudentRates.instructorProfileId, instructorId),
            eq(privateLessonStudentRates.active, true),
            isNull(privateLessonStudentRates.effectiveUntil),
          ),
        ),
      database
        .select({
          expiresAt: userInvitations.expiresAt,
          status: userInvitations.status,
          username: userInvitations.username,
        })
        .from(instructorAccountInvitations)
        .innerJoin(
          userInvitations,
          eq(userInvitations.id, instructorAccountInvitations.invitationId),
        )
        .where(eq(instructorAccountInvitations.instructorId, instructorId))
        .orderBy(desc(userInvitations.createdAt))
        .limit(1),
    ]);

  const invitationRow = invitation[0];

  return {
    accountStatus: profile.accountStatus ?? undefined,
    biography: profile.biography ?? undefined,
    branchCount: branches.length,
    branches,
    competencies: groupCompetencies(competencies).get(instructorId) ?? [],
    documents: documents.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
      notes: document.notes ?? undefined,
    })),
    email: profile.email,
    firstName: profile.firstName,
    fullName: fullName(profile.firstName, profile.lastName),
    id: profile.id,
    internalNotes: profile.internalNotes ?? undefined,
    invitation: invitationRow
      ? {
          expiresAt: invitationRow.expiresAt.toISOString(),
          status: invitationRow.status,
          username: invitationRow.username,
        }
      : undefined,
    lastName: profile.lastName,
    phone: profile.phone,
    photoMediaAssetId: profile.photoMediaAssetId ?? undefined,
    privateLessonLanguages:
      profile.status === 'active'
        ? rates.map((rate) => rate.language as ProgramLanguage)
        : [],
    specialties: profile.specialties,
    status: profile.status,
    userId: profile.userId ?? undefined,
    username: profile.username ?? undefined,
  };
}

export async function createInstructorProfile(
  principal: WorkspacePrincipal,
  input: InstructorInput,
) {
  assertAdmin(principal);
  const values = validateInstructorInput(input);

  return database.transaction(async (transaction) => {
    const [profile] = await transaction
      .insert(instructorProfiles)
      .values({
        ...values.profile,
        createdByUserId: principal.id,
      })
      .returning({ id: instructorProfiles.id });

    if (!profile) throw new Error('Instructor profile could not be created.');

    await transaction.insert(instructorLanguageCompetencies).values(
      values.competencies.map((competency) => ({
        instructorId: profile.id,
        ...competency,
      })),
    );

    return profile;
  });
}

export async function updateInstructorProfile(
  principal: WorkspacePrincipal,
  instructorId: string,
  input: InstructorInput,
) {
  assertAdmin(principal);
  const values = validateInstructorInput(input);

  return database.transaction(async (transaction) => {
    const [existing] = await transaction
      .select({ id: instructorProfiles.id })
      .from(instructorProfiles)
      .where(eq(instructorProfiles.id, instructorId))
      .limit(1)
      .for('update');

    if (!existing) throw new PublicFlowError('instructor_not_found', 404);

    await transaction
      .update(instructorProfiles)
      .set({
        ...values.profile,
        archivedAt: input.status === 'archived' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(instructorProfiles.id, instructorId));

    await transaction
      .delete(instructorLanguageCompetencies)
      .where(eq(instructorLanguageCompetencies.instructorId, instructorId));
    await transaction.insert(instructorLanguageCompetencies).values(
      values.competencies.map((competency) => ({
        instructorId,
        ...competency,
      })),
    );

    return { id: instructorId };
  });
}

export async function setInstructorPhoto(
  principal: WorkspacePrincipal,
  instructorId: string,
  mediaAssetId: string,
) {
  assertAdmin(principal);
  await assertInstructorExists(instructorId);
  await assertReadyPrivateMedia(mediaAssetId, ['image']);

  await database
    .update(instructorProfiles)
    .set({ photoMediaAssetId: mediaAssetId, updatedAt: new Date() })
    .where(eq(instructorProfiles.id, instructorId));

  return { id: instructorId, mediaAssetId };
}

export async function attachInstructorDocument(
  principal: WorkspacePrincipal,
  instructorId: string,
  input: {
    kind: 'certificate' | 'identity' | 'contract' | 'other';
    label: string;
    mediaAssetId: string;
    notes?: string;
  },
) {
  assertAdmin(principal);
  await assertInstructorExists(instructorId);
  await assertReadyPrivateMedia(input.mediaAssetId, ['document', 'image']);

  const label = clean(input.label);
  if (label.length < 2) {
    throw new PublicFlowError('invalid_instructor_document', 400);
  }

  const [document] = await database
    .insert(instructorDocuments)
    .values({
      createdByUserId: principal.id,
      instructorId,
      kind: input.kind,
      label,
      mediaAssetId: input.mediaAssetId,
      notes: cleanOptional(input.notes),
    })
    .returning({ id: instructorDocuments.id });

  return document;
}

async function assertInstructorExists(instructorId: string) {
  const [profile] = await database
    .select({ id: instructorProfiles.id })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.id, instructorId))
    .limit(1);
  if (!profile) throw new PublicFlowError('instructor_not_found', 404);
}

async function assertReadyPrivateMedia(
  mediaAssetId: string,
  kinds: Array<'image' | 'document'>,
) {
  const [asset] = await database
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, mediaAssetId),
        eq(mediaAssets.status, 'ready'),
        eq(mediaAssets.visibility, 'private'),
        inArray(mediaAssets.kind, kinds),
      ),
    )
    .limit(1);
  if (!asset) throw new PublicFlowError('media_not_ready', 409);
}

function validateInstructorInput(input: InstructorInput) {
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const email = input.email.trim().toLocaleLowerCase('en-US');
  const phone = normalizePhoneNumber(input.phone);
  const competencies = normalizeCompetencies(input.competencies);

  if (
    firstName.length < 2 ||
    lastName.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !phoneNumberIsValid(phone) ||
    competencies.length === 0
  ) {
    throw new PublicFlowError('invalid_instructor', 400);
  }

  return {
    competencies,
    profile: {
      biography: cleanOptional(input.biography),
      email,
      firstName,
      internalNotes: cleanOptional(input.internalNotes),
      lastName,
      phone,
      specialties: uniqueText(input.specialties),
      status: input.status,
    },
  };
}

function normalizeCompetencies(input: InstructorCompetency[]) {
  const byLanguage = new Map<ProgramLanguage, ProgramLevel[]>();

  for (const competency of input) {
    if (!supportedProgramLanguages.includes(competency.language)) continue;
    const levels = [...new Set(competency.levels)].filter((level) =>
      supportedProgramLevels.includes(level),
    );
    if (levels.length) byLanguage.set(competency.language, levels);
  }

  return [...byLanguage].map(([language, levels]) => ({ language, levels }));
}

function groupCompetencies(
  rows: Array<{ instructorId: string; language: string; levels: string[] }>,
) {
  const grouped = new Map<string, InstructorCompetency[]>();
  for (const row of rows) {
    const current = grouped.get(row.instructorId) ?? [];
    current.push({
      language: row.language as ProgramLanguage,
      levels: row.levels as ProgramLevel[],
    });
    grouped.set(row.instructorId, current);
  }
  return grouped;
}

function uniqueText(values: string[]) {
  return values.reduce<string[]>(
    (current, value) => appendUniqueTag(current, value),
    [],
  );
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function cleanOptional(value?: string) {
  const cleaned = value ? clean(value) : '';
  return cleaned || null;
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}
