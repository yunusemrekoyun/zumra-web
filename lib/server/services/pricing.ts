import 'server-only';

import { desc, eq, sql } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  contacts,
  discountPackages,
  enrollments,
  privateLessonPackages,
  programBranches,
  programs,
  studentProfiles,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim().replace(/\s+/g, ' ') ?? '';
  return cleaned || null;
}

type DiscountPackageInput = {
  active?: boolean;
  branchId?: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  endsAt?: string | null;
  name: string;
  note?: string | null;
  scope: 'branch' | 'private';
  startsAt?: string | null;
};

function validateDiscountPackageInput(input: DiscountPackageInput) {
  const name = cleanOptional(input.name);

  if (!name || name.length < 2) {
    throw new PublicFlowError('invalid_package_name', 400);
  }

  if (
    !Number.isInteger(input.discountValue) ||
    input.discountValue <= 0 ||
    input.discountValue > 100_000_000 ||
    (input.discountType === 'percentage' && input.discountValue > 10_000)
  ) {
    throw new PublicFlowError('invalid_discount_value', 400);
  }

  if ((input.scope === 'branch') !== Boolean(input.branchId)) {
    throw new PublicFlowError('invalid_package_scope', 400);
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;

  if (
    (startsAt && Number.isNaN(startsAt.getTime())) ||
    (endsAt && Number.isNaN(endsAt.getTime())) ||
    (startsAt && endsAt && endsAt <= startsAt)
  ) {
    throw new PublicFlowError('invalid_package_validity', 400);
  }

  return { endsAt, name, startsAt };
}

export async function createDiscountPackage(
  principal: WorkspacePrincipal,
  input: DiscountPackageInput,
) {
  assertAdmin(principal);
  const { endsAt, name, startsAt } = validateDiscountPackageInput(input);

  if (input.branchId) {
    const [branch] = await database
      .select({ id: programBranches.id })
      .from(programBranches)
      .where(eq(programBranches.id, input.branchId))
      .limit(1);

    if (!branch) {
      throw new PublicFlowError('branch_not_found', 404);
    }
  }

  const [created] = await database
    .insert(discountPackages)
    .values({
      active: input.active ?? true,
      branchId: input.scope === 'branch' ? input.branchId : null,
      createdByUserId: principal.id,
      discountType: input.discountType,
      discountValue: input.discountValue,
      endsAt,
      name,
      note: cleanOptional(input.note),
      scope: input.scope,
      startsAt,
    })
    .returning({ id: discountPackages.id });

  return { id: created.id };
}

export async function updateDiscountPackage(
  principal: WorkspacePrincipal,
  packageId: string,
  input: DiscountPackageInput,
) {
  assertAdmin(principal);
  const { endsAt, name, startsAt } = validateDiscountPackageInput(input);

  const [existing] = await database
    .select({
      branchId: discountPackages.branchId,
      id: discountPackages.id,
      scope: discountPackages.scope,
    })
    .from(discountPackages)
    .where(eq(discountPackages.id, packageId))
    .limit(1);

  if (!existing) {
    throw new PublicFlowError('discount_package_not_found', 404);
  }

  // Scope and branch are identity, not settings: re-targeting would silently
  // change what past drafts' package references meant.
  if (
    existing.scope !== input.scope ||
    (input.scope === 'branch' && input.branchId !== existing.branchId)
  ) {
    throw new PublicFlowError('invalid_package_scope', 400);
  }

  await database
    .update(discountPackages)
    .set({
      active: input.active ?? true,
      branchId: input.scope === 'branch' ? input.branchId : null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      endsAt,
      name,
      note: cleanOptional(input.note),
      startsAt,
      updatedAt: new Date(),
    })
    .where(eq(discountPackages.id, packageId));

  return { id: packageId };
}

type PrivateLessonPackageInput = {
  active?: boolean;
  displayOrder?: number;
  hourlyPriceCents: number;
  hours: number;
  language: string;
  name: string;
  note?: string | null;
  totalPriceCents: number;
};

function validateLessonPackageInput(input: PrivateLessonPackageInput) {
  const name = cleanOptional(input.name);

  if (!name || name.length < 2) {
    throw new PublicFlowError('invalid_package_name', 400);
  }

  if (
    !Number.isInteger(input.hours) ||
    input.hours <= 0 ||
    input.hours > 1000 ||
    !Number.isInteger(input.totalPriceCents) ||
    input.totalPriceCents <= 0 ||
    input.totalPriceCents > 100_000_000 ||
    !Number.isInteger(input.hourlyPriceCents) ||
    input.hourlyPriceCents <= 0 ||
    input.hourlyPriceCents > 100_000_000
  ) {
    throw new PublicFlowError('invalid_package_values', 400);
  }

  return { name };
}

export async function createPrivateLessonPackage(
  principal: WorkspacePrincipal,
  input: PrivateLessonPackageInput,
) {
  assertAdmin(principal);
  const { name } = validateLessonPackageInput(input);

  const [created] = await database
    .insert(privateLessonPackages)
    .values({
      active: input.active ?? true,
      createdByUserId: principal.id,
      displayOrder: input.displayOrder ?? 0,
      hourlyPriceCents: input.hourlyPriceCents,
      hours: input.hours,
      language: input.language,
      name,
      note: cleanOptional(input.note),
      totalPriceCents: input.totalPriceCents,
    })
    .returning({ id: privateLessonPackages.id });

  return { id: created.id };
}

export async function updatePrivateLessonPackage(
  principal: WorkspacePrincipal,
  packageId: string,
  input: PrivateLessonPackageInput,
) {
  assertAdmin(principal);
  const { name } = validateLessonPackageInput(input);

  const [existing] = await database
    .select({ id: privateLessonPackages.id })
    .from(privateLessonPackages)
    .where(eq(privateLessonPackages.id, packageId))
    .limit(1);

  if (!existing) {
    throw new PublicFlowError('private_lesson_package_not_found', 404);
  }

  await database
    .update(privateLessonPackages)
    .set({
      active: input.active ?? true,
      displayOrder: input.displayOrder ?? 0,
      hourlyPriceCents: input.hourlyPriceCents,
      hours: input.hours,
      language: input.language,
      name,
      note: cleanOptional(input.note),
      totalPriceCents: input.totalPriceCents,
      updatedAt: new Date(),
    })
    .where(eq(privateLessonPackages.id, packageId));

  return { id: packageId };
}

export type ManualDiscountView = {
  courseLabel: string;
  discountCents: number;
  discountNote: string | null;
  enrolledAt: string;
  enrollmentId: string;
  finalPriceCents: number;
  listPriceCents: number | null;
  studentName: string;
};

// The flagged list on the İndirimler screen: every completed enrollment whose
// discount was entered off-catalog (financialSnapshot.discountSource='manual').
export async function listManualDiscounts(
  principal: WorkspacePrincipal,
): Promise<ManualDiscountView[]> {
  assertAdmin(principal);

  const rows = await database
    .select({
      branchName: programBranches.name,
      enrolledAt: enrollments.enrolledAt,
      finalPriceCents: enrollments.finalPriceCents,
      financialSnapshot: enrollments.financialSnapshot,
      id: enrollments.id,
      programName: programs.name,
      studentFirstName: contacts.firstName,
      studentLastName: contacts.lastName,
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(studentProfiles.id, enrollments.studentId))
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .leftJoin(programBranches, eq(programBranches.id, enrollments.branchId))
    .leftJoin(programs, eq(programs.id, enrollments.programId))
    .where(sql`${enrollments.financialSnapshot}->>'discountSource' = 'manual'`)
    .orderBy(desc(enrollments.enrolledAt))
    .limit(200);

  return rows.map((row) => {
    const snapshot = row.financialSnapshot as Record<string, unknown>;

    return {
      courseLabel:
        [row.programName, row.branchName].filter(Boolean).join(' — ') || '—',
      discountCents: Number(snapshot.discountCents ?? 0),
      discountNote:
        typeof snapshot.discountNote === 'string'
          ? snapshot.discountNote
          : null,
      enrolledAt: row.enrolledAt.toISOString(),
      enrollmentId: row.id,
      finalPriceCents: row.finalPriceCents,
      listPriceCents:
        typeof snapshot.listPriceCents === 'number'
          ? snapshot.listPriceCents
          : null,
      studentName:
        `${row.studentFirstName} ${row.studentLastName}`.trim(),
    };
  });
}
