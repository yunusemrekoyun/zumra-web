import 'server-only';

import { and, desc, eq, gt, inArray, ne } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import {
  ageOnDate,
  isValidBirthDate,
} from '@/lib/domain/enrollment-validation';
import {
  normalizePhoneNumber,
  phoneNumberIsValid,
} from '@/lib/domain/phone';
import { database } from '@/lib/server/db/client';
import {
  advisorTasks,
  appointmentRequests,
  assessmentAttempts,
  candidateActivities,
  candidateInquiries,
  candidateProfiles,
  contacts,
  discountPackages,
  enrollmentDocuments,
  enrollmentDrafts,
  enrollmentParties,
  enrollments,
  mediaAssets,
  privateLessonPackages,
  studentAccountInvitations,
  studentProfiles,
  userInvitations,
  users,
} from '@/lib/server/db/schema';
import { getAuthEnv } from '@/lib/server/env';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import {
  maskIdentityDocument,
  protectIdentityDocument,
} from '@/lib/server/security/identity';
import { createOpaqueToken } from '@/lib/server/security/tokens';
import { assertValidUsername } from '@/lib/server/security/username';
import {
  type ProgramLanguage,
  resolveProgramBranchSelection,
  resolveProgramPricing,
} from '@/lib/server/services/programs';
import { closeSystemTasks, spawnSystemTask } from './advisor-tasks';
import { notificationService } from './notifications';
import { notifyManualDiscountApplied } from './notify-events';
import { generateDefaultInstallmentPlan } from './payments';

// Legacy contacts may hold national-format phones; normalize on read so the
// enrollment wizard prefills a value that passes its own E.164 validation.
function prefillPhone(value: string | null | undefined) {
  return value ? normalizePhoneNumber(value) : '';
}

type IdentityDocumentType = 'national_id' | 'passport';
type GenderIdentity =
  | 'female'
  | 'male'
  | 'non_binary'
  | 'other'
  | 'prefer_not_to_say';
type PartyRelationship = 'mother' | 'father' | 'sibling' | 'other';
type PartyRole = 'guardian' | 'payer' | 'promissory_debtor' | 'other';
type EnrollmentTransaction = Parameters<
  Parameters<typeof database.transaction>[0]
>[0];

type StudentInvitationDelivery = {
  email: string;
  expiresAt: Date;
  id: string;
  locale: 'tr' | 'en';
  name: string;
  token: string;
  username: string;
};

const STUDENT_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

export type EnrollmentPartyInput = {
  email?: string;
  fullName: string;
  id?: string;
  identityDocument?: string;
  identityDocumentType?: IdentityDocumentType;
  phone?: string;
  relationship: PartyRelationship;
  relationshipOther?: string;
  roles: PartyRole[];
};

export type EnrollmentDraftPatch =
  | {
      step: 1;
      data: {
        birthAdministrativeArea?: string;
        birthCountryCode?: string;
        birthDate?: string;
        birthLocality?: string;
        firstName: string;
        gender?: GenderIdentity | '';
        identityDocument?: string;
        identityDocumentType: IdentityDocumentType;
        lastName: string;
        school?: string;
      };
    }
  | {
      step: 2;
      data: {
        email: string;
        parties: EnrollmentPartyInput[];
        primaryPhone: string;
        residenceAddress: string;
        secondaryPhone?: string;
        studentIsContractParty: boolean;
        username: string;
      };
    }
  | {
      step: 3;
      data: {
        branchId?: string;
        capacityOverride?: boolean;
        capacityOverrideNote?: string;
        instagramHandle?: string;
        privateLessonHours?: number;
        privateLessonLanguage?: ProgramLanguage;
        privateLessonPackageId?: string | null;
        programId: string;
        instructorProfileId?: string;
      };
    }
  | {
      step: 4;
      data: {
        correctedSource?: string;
        correctedSourceDetail?: string;
      };
    }
  | {
      step: 5;
      data: {
        registrationChannel: string;
      };
    }
  | {
      step: 6;
      data: Record<string, never>;
    }
  | {
      step: 7;
      data: {
        discountNote?: string;
        discountPackageId?: string | null;
        discountType: 'none' | 'percentage' | 'fixed';
        discountValue: number;
        financialNotes?: string;
        initialPaymentCents: number;
        installmentCount: number;
        paymentMethod?: string;
      };
    }
  | {
      step: 8;
      data: {
        scheduleMode: 'inherited' | 'custom' | 'pending';
        scheduleNotes?: string;
        schedulePreferences: Array<{
          day: string;
          endTime: string;
          startTime: string;
        }>;
      };
    }
  | {
      step: 9;
      data: {
        internalNotes?: string;
      };
    };

export type EnrollmentDraftView = {
  candidate: {
    id: string;
    originalSource?: string;
  };
  createdByName: string;
  documents: Array<{
    id: string;
    label: string;
    mediaAssetId: string;
    status: string;
    type: string;
  }>;
  draft: {
    birthAdministrativeArea?: string;
    birthCountryCode?: string;
    birthDate?: string;
    birthLocality?: string;
    birthPlace?: string;
    branchId?: string;
    branchName?: string;
    capacityOverride: boolean;
    capacityOverrideNote?: string;
    correctedSource?: string;
    correctedSourceDetail?: string;
    courseMode?: 'group' | 'private';
    currency: 'TRY';
    currentStep: number;
    discountCents: number;
    discountNote?: string;
    discountPackageId?: string;
    discountPackageName?: string;
    discountType: 'none' | 'percentage' | 'fixed';
    discountValue: number;
    email: string;
    finalPriceCents?: number;
    financialNotes?: string;
    firstName: string;
    gender?: GenderIdentity;
    id: string;
    identityDocumentMasked?: string;
    identityDocumentType?: IdentityDocumentType;
    initialPaymentCents: number;
    instagramHandle?: string;
    installmentCount: number;
    internalNotes?: string;
    lastName: string;
    lastSavedAt: string;
    listPriceCents?: number;
    paymentMethod?: string;
    primaryPhone: string;
    privateLessonHours?: number;
    privateLessonLanguage?: ProgramLanguage;
    privateLessonPackageId?: string;
    privateLessonPackageName?: string;
    privateLessonRateId?: string;
    programLabel?: string;
    programReferenceId?: string;
    registrationChannel?: string;
    residenceAddress: string;
    scheduleMode: 'inherited' | 'custom' | 'pending';
    scheduleNotes?: string;
    schedulePreferences: Array<{
      day: string;
      endTime: string;
      startTime: string;
    }>;
    school?: string;
    secondaryPhone?: string;
    sectionId?: string;
    selectedInstructorProfileId?: string;
    status: string;
    studentIsContractParty: boolean;
    studentUsername?: string;
  };
  parties: Array<{
    email?: string;
    fullName: string;
    id: string;
    identityDocumentMasked?: string;
    identityDocumentType?: IdentityDocumentType;
    phone?: string;
    relationship: PartyRelationship;
    relationshipOther?: string;
    roles: PartyRole[];
  }>;
};

// Validates a discount package against the draft's current target and returns
// the server-authoritative type/value. Throws when the package is missing,
// inactive, outside its campaign window, or scoped to a different target.
async function resolveDraftDiscountPackage(
  transaction: EnrollmentTransaction,
  packageId: string,
  draft: { branchId: string | null; courseMode: string | null },
) {
  const [pkg] = await transaction
    .select({
      active: discountPackages.active,
      branchId: discountPackages.branchId,
      discountType: discountPackages.discountType,
      discountValue: discountPackages.discountValue,
      endsAt: discountPackages.endsAt,
      id: discountPackages.id,
      scope: discountPackages.scope,
      startsAt: discountPackages.startsAt,
    })
    .from(discountPackages)
    .where(eq(discountPackages.id, packageId))
    .limit(1);

  if (!pkg || !pkg.active) {
    throw new PublicFlowError('discount_package_not_found', 409);
  }

  const nowMs = Date.now();

  if (
    (pkg.startsAt && pkg.startsAt.getTime() > nowMs) ||
    (pkg.endsAt && pkg.endsAt.getTime() <= nowMs)
  ) {
    throw new PublicFlowError('discount_package_expired', 409);
  }

  const scopeMatches =
    draft.courseMode === 'group'
      ? pkg.scope === 'branch' && pkg.branchId === draft.branchId
      : pkg.scope === 'private';

  if (!scopeMatches) {
    throw new PublicFlowError('discount_package_scope_mismatch', 409);
  }

  return pkg;
}

export async function beginEnrollmentDraft(
  principal: WorkspacePrincipal,
  candidateId: string,
) {
  assertAdmin(principal);

  const result = await database.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select({
        advisorId: candidateProfiles.advisorId,
        contactId: candidateProfiles.contactId,
        email: contacts.email,
        firstName: contacts.firstName,
        id: candidateProfiles.id,
        lastName: contacts.lastName,
        phone: contacts.phone,
      })
      .from(candidateProfiles)
      .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
      .where(eq(candidateProfiles.id, candidateId))
      .limit(1);

    if (!candidate) {
      throw new PublicFlowError('candidate_not_found', 404);
    }

    const [existing] = await transaction
      .select({ id: enrollmentDrafts.id })
      .from(enrollmentDrafts)
      .where(
        and(
          eq(enrollmentDrafts.candidateId, candidateId),
          inArray(enrollmentDrafts.status, [
            'draft',
            'review_required',
            'ready',
          ]),
        ),
      )
      .limit(1);

    if (existing) {
      return { advisorId: candidate.advisorId, created: false, id: existing.id };
    }

    const [draft] = await transaction
      .insert(enrollmentDrafts)
      .values({
        candidateId,
        createdByUserId: principal.id,
        email: candidate.email,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        // Normalize legacy national-format contact phones to E.164 so step 2
        // opens with a value that passes the wizard's own validation.
        primaryPhone: candidate.phone
          ? normalizePhoneNumber(candidate.phone)
          : candidate.phone,
      })
      // Two staff opening the wizard at once: the one-active-draft unique
      // index wins the race, and the loser reuses the winner's draft.
      .onConflictDoNothing()
      .returning({ id: enrollmentDrafts.id });

    if (!draft) {
      const [concurrent] = await transaction
        .select({ id: enrollmentDrafts.id })
        .from(enrollmentDrafts)
        .where(
          and(
            eq(enrollmentDrafts.candidateId, candidateId),
            inArray(enrollmentDrafts.status, [
              'draft',
              'review_required',
              'ready',
            ]),
          ),
        )
        .limit(1);
      if (concurrent) {
        return {
          advisorId: candidate.advisorId,
          created: false,
          id: concurrent.id,
        };
      }
      throw new Error('Enrollment draft could not be created.');
    }

    const now = new Date();
    await transaction.insert(candidateActivities).values({
      candidateId,
      metadata: { draftId: draft.id },
      occurredAt: now,
      type: 'candidate.enrollment_started',
    });
    await transaction
      .update(candidateProfiles)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(eq(candidateProfiles.id, candidateId));

    return { advisorId: candidate.advisorId, created: true, id: draft.id };
  });

  // A fresh draft opens follow-through work for the owning advisor: chase the
  // remaining steps until the enrollment is completed (closed on completion).
  if (result.created) {
    await spawnSystemTask({
      assigneeUserId: result.advisorId,
      candidateId,
      kind: 'enrollment_wrapup',
    });
  }

  return { created: result.created, id: result.id };
}

export async function getEnrollmentDraftForAdmin(
  principal: WorkspacePrincipal,
  candidateId: string,
): Promise<EnrollmentDraftView | null> {
  assertAdmin(principal);

  const [row] = await database
    .select({
      branchId: enrollmentDrafts.branchId,
      candidateId: candidateProfiles.id,
      birthAdministrativeArea:
        enrollmentDrafts.birthAdministrativeArea,
      birthCountryCode: enrollmentDrafts.birthCountryCode,
      birthLocality: enrollmentDrafts.birthLocality,
      capacityOverride: enrollmentDrafts.capacityOverride,
      capacityOverrideNote: enrollmentDrafts.capacityOverrideNote,
      correctedSource: enrollmentDrafts.correctedSource,
      correctedSourceDetail: enrollmentDrafts.correctedSourceDetail,
      courseMode: enrollmentDrafts.courseMode,
      createdByName: users.name,
      currency: enrollmentDrafts.currency,
      currentStep: enrollmentDrafts.currentStep,
      discountCents: enrollmentDrafts.discountCents,
      discountNote: enrollmentDrafts.discountNote,
      discountPackageId: enrollmentDrafts.discountPackageId,
      discountType: enrollmentDrafts.discountType,
      discountValue: enrollmentDrafts.discountValue,
      draftBirthDate: enrollmentDrafts.birthDate,
      draftBirthPlace: enrollmentDrafts.birthPlace,
      draftEmail: enrollmentDrafts.email,
      draftFirstName: enrollmentDrafts.firstName,
      draftGender: enrollmentDrafts.gender,
      draftId: enrollmentDrafts.id,
      draftLastName: enrollmentDrafts.lastName,
      draftPrimaryPhone: enrollmentDrafts.primaryPhone,
      draftSchool: enrollmentDrafts.school,
      draftStudentUsername: enrollmentDrafts.studentUsername,
      email: contacts.email,
      finalPriceCents: enrollmentDrafts.finalPriceCents,
      financialNotes: enrollmentDrafts.financialNotes,
      firstName: contacts.firstName,
      identityDocumentLastFour:
        enrollmentDrafts.identityDocumentLastFour,
      identityDocumentType: enrollmentDrafts.identityDocumentType,
      initialPaymentCents: enrollmentDrafts.initialPaymentCents,
      instagramHandle: enrollmentDrafts.instagramHandle,
      installmentCount: enrollmentDrafts.installmentCount,
      internalNotes: enrollmentDrafts.internalNotes,
      lastName: contacts.lastName,
      lastSavedAt: enrollmentDrafts.lastSavedAt,
      listPriceCents: enrollmentDrafts.listPriceCents,
      paymentMethod: enrollmentDrafts.paymentMethod,
      phone: contacts.phone,
      privateLessonHours: enrollmentDrafts.privateLessonHours,
      privateLessonLanguage: enrollmentDrafts.privateLessonLanguage,
      privateLessonPackageId: enrollmentDrafts.privateLessonPackageId,
      privateLessonRateId: enrollmentDrafts.privateLessonRateId,
      programReferenceId: enrollmentDrafts.programReferenceId,
      programSelection: enrollmentDrafts.programSelection,
      registrationChannel: enrollmentDrafts.registrationChannel,
      residenceAddress: enrollmentDrafts.residenceAddress,
      scheduleMode: enrollmentDrafts.scheduleMode,
      scheduleNotes: enrollmentDrafts.scheduleNotes,
      schedulePreferences: enrollmentDrafts.schedulePreferences,
      secondaryPhone: enrollmentDrafts.secondaryPhone,
      selectedInstructorProfileId:
        enrollmentDrafts.selectedInstructorProfileId,
      status: enrollmentDrafts.status,
      studentIsContractParty: enrollmentDrafts.studentIsContractParty,
      // Package names ride along so the wizard can label a stored package even
      // when it has since expired out of the selectable catalog.
      discountPackageName: discountPackages.name,
      privateLessonPackageName: privateLessonPackages.name,
    })
    .from(enrollmentDrafts)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, enrollmentDrafts.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .innerJoin(users, eq(users.id, enrollmentDrafts.createdByUserId))
    .leftJoin(
      discountPackages,
      eq(discountPackages.id, enrollmentDrafts.discountPackageId),
    )
    .leftJoin(
      privateLessonPackages,
      eq(privateLessonPackages.id, enrollmentDrafts.privateLessonPackageId),
    )
    .where(
      and(
        eq(enrollmentDrafts.candidateId, candidateId),
        inArray(enrollmentDrafts.status, [
          'draft',
          'review_required',
          'ready',
          'completed',
        ]),
      ),
    )
    .orderBy(desc(enrollmentDrafts.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }

  const [parties, documents, latestInquiry] = await Promise.all([
    database
      .select()
      .from(enrollmentParties)
      .where(eq(enrollmentParties.draftId, row.draftId))
      .orderBy(enrollmentParties.createdAt),
    database
      .select({
        id: enrollmentDocuments.id,
        label: enrollmentDocuments.label,
        mediaAssetId: enrollmentDocuments.mediaAssetId,
        status: enrollmentDocuments.status,
        type: enrollmentDocuments.type,
      })
      .from(enrollmentDocuments)
      .where(eq(enrollmentDocuments.draftId, row.draftId))
      .orderBy(enrollmentDocuments.createdAt),
    database
      .select({ source: candidateInquiries.source })
      .from(candidateInquiries)
      .where(eq(candidateInquiries.candidateId, candidateId))
      .orderBy(desc(candidateInquiries.createdAt))
      .limit(1),
  ]);

  return {
    candidate: {
      id: row.candidateId,
      originalSource: latestInquiry[0]?.source,
    },
    createdByName: row.createdByName,
    documents,
    draft: {
      birthAdministrativeArea:
        row.birthAdministrativeArea ?? row.draftBirthPlace ?? undefined,
      birthCountryCode:
        row.birthCountryCode ?? (row.draftBirthPlace ? 'TR' : undefined),
      birthDate: row.draftBirthDate ?? undefined,
      birthLocality:
        row.birthLocality ?? row.draftBirthPlace ?? undefined,
      birthPlace: row.draftBirthPlace ?? undefined,
      branchId: row.branchId ?? undefined,
      branchName: row.programSelection.branchName,
      capacityOverride: row.capacityOverride,
      capacityOverrideNote: row.capacityOverrideNote ?? undefined,
      correctedSource: row.correctedSource ?? undefined,
      correctedSourceDetail: row.correctedSourceDetail ?? undefined,
      courseMode: row.courseMode ?? undefined,
      currency: 'TRY',
      currentStep: row.currentStep,
      discountCents: row.discountCents,
      discountNote: row.discountNote ?? undefined,
      discountPackageId: row.discountPackageId ?? undefined,
      discountPackageName: row.discountPackageName ?? undefined,
      discountType: row.discountType,
      discountValue: row.discountValue,
      email: row.draftEmail ?? row.email,
      finalPriceCents: row.finalPriceCents ?? undefined,
      financialNotes: row.financialNotes ?? undefined,
      firstName: row.draftFirstName ?? row.firstName,
      gender: row.draftGender ?? undefined,
      id: row.draftId,
      identityDocumentMasked:
        maskIdentityDocument(
          row.identityDocumentType,
          row.identityDocumentLastFour,
        ) ?? undefined,
      identityDocumentType: row.identityDocumentType ?? undefined,
      initialPaymentCents: row.initialPaymentCents,
      instagramHandle: row.instagramHandle ?? undefined,
      installmentCount: row.installmentCount,
      internalNotes: row.internalNotes ?? undefined,
      lastName: row.draftLastName ?? row.lastName,
      lastSavedAt: row.lastSavedAt.toISOString(),
      listPriceCents: row.listPriceCents ?? undefined,
      paymentMethod: row.paymentMethod ?? undefined,
      primaryPhone: prefillPhone(row.draftPrimaryPhone ?? row.phone),
      privateLessonHours: row.privateLessonHours ?? undefined,
      privateLessonLanguage:
        (row.privateLessonLanguage as ProgramLanguage | null) ?? undefined,
      privateLessonPackageId: row.privateLessonPackageId ?? undefined,
      privateLessonPackageName: row.privateLessonPackageName ?? undefined,
      privateLessonRateId: row.privateLessonRateId ?? undefined,
      programLabel: row.programSelection.label,
      programReferenceId:
        row.programSelection.programId ??
        row.programReferenceId ??
        undefined,
      registrationChannel: row.registrationChannel ?? undefined,
      residenceAddress: row.residenceAddress ?? '',
      scheduleMode:
        row.scheduleMode === 'inherited' || row.scheduleMode === 'custom'
          ? row.scheduleMode
          : 'pending',
      scheduleNotes: row.scheduleNotes ?? undefined,
      schedulePreferences: row.schedulePreferences,
      school: row.draftSchool ?? undefined,
      secondaryPhone: row.secondaryPhone ?? undefined,
      sectionId: row.programSelection.sectionId,
      selectedInstructorProfileId:
        row.selectedInstructorProfileId ?? undefined,
      status: row.status,
      studentIsContractParty: row.studentIsContractParty,
      studentUsername: row.draftStudentUsername ?? undefined,
    },
    parties: parties.map((party) => ({
      email: party.email ?? undefined,
      fullName: party.fullName,
      id: party.id,
      identityDocumentMasked:
        maskIdentityDocument(
          party.identityDocumentType,
          party.identityDocumentLastFour,
        ) ?? undefined,
      identityDocumentType: party.identityDocumentType ?? undefined,
      phone: party.phone ?? undefined,
      relationship: party.relationship,
      relationshipOther: party.relationshipOther ?? undefined,
      roles: party.roles,
    })),
  };
}

export async function updateEnrollmentDraft(
  principal: WorkspacePrincipal,
  draftId: string,
  patch: EnrollmentDraftPatch,
) {
  assertAdmin(principal);
  const now = new Date();

  const result = await database.transaction(async (transaction) => {
    const [draft] = await transaction
      .select({
        candidateId: enrollmentDrafts.candidateId,
        contactId: candidateProfiles.contactId,
        identityDocumentEncrypted:
          enrollmentDrafts.identityDocumentEncrypted,
        identityDocumentType: enrollmentDrafts.identityDocumentType,
        branchId: enrollmentDrafts.branchId,
        capacityOverride: enrollmentDrafts.capacityOverride,
        capacityOverrideNote: enrollmentDrafts.capacityOverrideNote,
        courseMode: enrollmentDrafts.courseMode,
        discountNote: enrollmentDrafts.discountNote,
        discountPackageId: enrollmentDrafts.discountPackageId,
        discountType: enrollmentDrafts.discountType,
        discountValue: enrollmentDrafts.discountValue,
        finalPriceCents: enrollmentDrafts.finalPriceCents,
        initialPaymentCents: enrollmentDrafts.initialPaymentCents,
        listPriceCents: enrollmentDrafts.listPriceCents,
        privateLessonHours: enrollmentDrafts.privateLessonHours,
        privateLessonLanguage: enrollmentDrafts.privateLessonLanguage,
        privateLessonPackageId: enrollmentDrafts.privateLessonPackageId,
        privateLessonRateId: enrollmentDrafts.privateLessonRateId,
        programId: enrollmentDrafts.programId,
        selectedInstructorProfileId:
          enrollmentDrafts.selectedInstructorProfileId,
        status: enrollmentDrafts.status,
      })
      .from(enrollmentDrafts)
      .innerJoin(
        candidateProfiles,
        eq(candidateProfiles.id, enrollmentDrafts.candidateId),
      )
      .where(eq(enrollmentDrafts.id, draftId))
      .limit(1);

    if (!draft) {
      throw new PublicFlowError('enrollment_draft_not_found', 404);
    }

    if (!['draft', 'review_required', 'ready'].includes(draft.status)) {
      throw new PublicFlowError('enrollment_draft_locked', 409);
    }

    const common = {
      currentStep: patch.step,
      lastSavedAt: now,
      status: patch.step === 9 ? ('review_required' as const) : draft.status,
      updatedAt: now,
    };

    if (patch.step === 1) {
      const birthAdministrativeArea = cleanOptional(
        patch.data.birthAdministrativeArea,
      );
      const birthCountryCode = cleanOptional(
        patch.data.birthCountryCode,
      )?.toUpperCase();
      const birthLocality = cleanOptional(patch.data.birthLocality);
      const hasBirthLocation = Boolean(
        birthAdministrativeArea || birthLocality,
      );
      if (
        hasBirthLocation &&
        (!birthCountryCode ||
          !/^[A-Z]{2}$/.test(birthCountryCode) ||
          !birthAdministrativeArea ||
          !birthLocality)
      ) {
        throw new PublicFlowError('invalid_birth_location', 400);
      }
      let identity: ReturnType<typeof protectIdentityDocument> | null = null;
      if (patch.data.identityDocument) {
        try {
          identity = protectIdentityDocument(
            patch.data.identityDocumentType,
            patch.data.identityDocument,
          );
        } catch {
          throw new PublicFlowError('invalid_identity_document', 400);
        }
      }

      const birthDate = parseDateOnly(patch.data.birthDate);

      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          birthAdministrativeArea: hasBirthLocation
            ? birthAdministrativeArea
            : null,
          birthCountryCode: hasBirthLocation ? birthCountryCode : null,
          birthDate,
          birthLocality: hasBirthLocation ? birthLocality : null,
          birthPlace: hasBirthLocation
            ? [
                birthLocality,
                birthAdministrativeArea,
                birthCountryCode,
              ].join(', ')
            : null,
          firstName: clean(patch.data.firstName),
          gender: patch.data.gender || null,
          identityDocumentBlindIndex: identity?.blindIndex,
          identityDocumentEncrypted: identity?.encrypted,
          identityDocumentLastFour: identity?.lastFour,
          identityDocumentType:
            identity?.normalized
              ? patch.data.identityDocumentType
              : draft.identityDocumentType,
          lastName: clean(patch.data.lastName),
          school: cleanOptional(patch.data.school),
        })
        .where(eq(enrollmentDrafts.id, draftId));

      await transaction
        .update(contacts)
        .set({
          firstName: clean(patch.data.firstName),
          lastName: clean(patch.data.lastName),
          updatedAt: now,
        })
        .where(eq(contacts.id, draft.contactId));
      return;
    }

    if (patch.step === 2) {
      const normalizedEmail = patch.data.email.trim().toLowerCase();
      const username = normalizeStudentUsername(patch.data.username);
      const primaryPhone = normalizePhoneNumber(patch.data.primaryPhone);
      const secondaryPhone = patch.data.secondaryPhone
        ? normalizePhoneNumber(patch.data.secondaryPhone)
        : null;

      if (
        !phoneNumberIsValid(primaryPhone) ||
        (secondaryPhone && !phoneNumberIsValid(secondaryPhone))
      ) {
        throw new PublicFlowError('invalid_phone', 400);
      }

      await assertAccountIdentityAvailable(transaction, {
        email: normalizedEmail,
        username,
      });

      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          email: normalizedEmail,
          primaryPhone,
          residenceAddress: clean(patch.data.residenceAddress),
          secondaryPhone,
          studentIsContractParty: patch.data.studentIsContractParty,
          studentUsername: username,
        })
        .where(eq(enrollmentDrafts.id, draftId));

      // The e-mail is being rewritten onto the candidate's contact row; if
      // another contact already owns it, surface a field error instead of
      // letting the unique index blow up as a generic conflict.
      const [emailOwner] = await transaction
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.normalizedEmail, normalizedEmail))
        .limit(1);
      if (emailOwner && emailOwner.id !== draft.contactId) {
        throw new PublicFlowError('enrollment_email_taken', 409);
      }

      await transaction
        .update(contacts)
        .set({
          email: normalizedEmail,
          normalizedEmail,
          normalizedPhone: primaryPhone,
          phone: primaryPhone,
          updatedAt: now,
        })
        .where(eq(contacts.id, draft.contactId));

      const existingParties = await transaction
        .select()
        .from(enrollmentParties)
        .where(eq(enrollmentParties.draftId, draftId));

      await transaction
        .delete(enrollmentParties)
        .where(eq(enrollmentParties.draftId, draftId));

      if (patch.data.parties.length) {
        await transaction.insert(enrollmentParties).values(
          patch.data.parties.map((party) => {
            const existingParty = existingParties.find(
              (item) => item.id === party.id,
            );
            const identity =
              party.identityDocument && party.identityDocumentType
                ? protectIdentityDocument(
                    party.identityDocumentType,
                    party.identityDocument,
                  )
                : null;
            const phone = party.phone
              ? normalizePhoneNumber(party.phone)
              : null;
            if (
              clean(party.fullName).length < 2 ||
              !party.roles.length ||
              (party.relationship === 'other' &&
                !cleanOptional(party.relationshipOther)) ||
              (phone && !phoneNumberIsValid(phone))
            ) {
              throw new PublicFlowError(
                'invalid_enrollment_party',
                400,
              );
            }

            return {
              draftId,
              email: cleanOptional(party.email)?.toLowerCase(),
              fullName: clean(party.fullName),
              identityDocumentBlindIndex:
                identity?.blindIndex ??
                existingParty?.identityDocumentBlindIndex,
              identityDocumentEncrypted:
                identity?.encrypted ??
                existingParty?.identityDocumentEncrypted,
              identityDocumentLastFour:
                identity?.lastFour ??
                existingParty?.identityDocumentLastFour,
              identityDocumentType:
                party.identityDocumentType ??
                existingParty?.identityDocumentType,
              phone,
              relationship: party.relationship,
              relationshipOther:
                party.relationship === 'other'
                  ? clean(party.relationshipOther ?? '')
                  : null,
              roles: party.roles,
              updatedAt: now,
            };
          }),
        );
      }
      return;
    }

    if (patch.step === 3) {
      const pricing = await resolveProgramPricing(transaction, {
        branchId: patch.data.branchId,
        capacityOverride: patch.data.capacityOverride,
        privateLessonHours: patch.data.privateLessonHours,
        privateLessonLanguage: patch.data.privateLessonLanguage,
        privateLessonPackageId: patch.data.privateLessonPackageId ?? undefined,
        programId: patch.data.programId,
        instructorProfileId: patch.data.instructorProfileId,
      });
      const capacityOverride =
        pricing.courseMode === 'group' &&
        pricing.atCapacity &&
        patch.data.capacityOverride === true;

      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          branchId:
            pricing.courseMode === 'group' ? pricing.branch.id : null,
          capacityOverride,
          capacityOverrideAt: capacityOverride ? now : null,
          capacityOverrideByUserId: capacityOverride ? principal.id : null,
          capacityOverrideNote: capacityOverride
            ? cleanOptional(patch.data.capacityOverrideNote)
            : null,
          courseMode: pricing.courseMode,
          discountAppliedByUserId: null,
          discountCents: 0,
          discountNote: null,
          discountPackageId: null,
          discountType: 'none',
          discountValue: 0,
          finalPriceCents: pricing.basePriceCents,
          instagramHandle: cleanOptional(patch.data.instagramHandle),
          listPriceCents: pricing.basePriceCents,
          privateLessonHours:
            pricing.courseMode === 'private'
              ? pricing.privateLessonHours
              : null,
          privateLessonLanguage:
            pricing.courseMode === 'private'
              ? patch.data.privateLessonLanguage
              : null,
          privateLessonPackageId:
            pricing.courseMode === 'private'
              ? (pricing.lessonPackage?.id ?? null)
              : null,
          privateLessonRateId:
            pricing.courseMode === 'private' ? pricing.rate.id : null,
          programId: pricing.program.id,
          programReferenceId: pricing.program.id,
          programSelection: pricing.snapshot,
          selectedInstructorProfileId:
            pricing.courseMode === 'private'
              ? patch.data.instructorProfileId
              : null,
        })
        .where(eq(enrollmentDrafts.id, draftId));
      return {
        draft: {
          branchId:
            pricing.courseMode === 'group' ? pricing.branch.id : undefined,
          branchName:
            pricing.courseMode === 'group'
              ? pricing.branch.name
              : undefined,
          capacityOverride,
          capacityOverrideNote: capacityOverride
            ? cleanOptional(patch.data.capacityOverrideNote) ?? undefined
            : undefined,
          courseMode: pricing.courseMode,
          discountCents: 0,
          discountType: 'none' as const,
          discountValue: 0,
          finalPriceCents: pricing.basePriceCents,
          listPriceCents: pricing.basePriceCents,
          privateLessonRateId:
            pricing.courseMode === 'private' ? pricing.rate.id : undefined,
          programLabel: pricing.snapshot.label,
        },
      };
    }

    if (patch.step === 4) {
      const correctedSource = cleanOptional(patch.data.correctedSource);
      const correctedSourceDetail =
        correctedSource === 'other'
          ? cleanOptional(patch.data.correctedSourceDetail)
          : undefined;
      if (correctedSource === 'other' && !correctedSourceDetail) {
        throw new PublicFlowError('source_detail_required', 400);
      }
      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          correctedSource,
          correctedSourceDetail: correctedSourceDetail ?? null,
        })
        .where(eq(enrollmentDrafts.id, draftId));
      return;
    }

    if (patch.step === 5) {
      const registrationChannel = clean(patch.data.registrationChannel);
      if (
        !['web', 'phone', 'whatsapp', 'video_call', 'other'].includes(
          registrationChannel,
        )
      ) {
        throw new PublicFlowError('invalid_registration_channel', 400);
      }
      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          registrationChannel,
        })
        .where(eq(enrollmentDrafts.id, draftId));
      return;
    }

    if (patch.step === 6) {
      if (!draft.programId || !draft.courseMode) {
        throw new PublicFlowError('program_price_missing', 409);
      }

      const pricing = await resolveProgramPricing(transaction, {
        branchId: draft.branchId ?? undefined,
        capacityOverride: draft.capacityOverride,
        privateLessonHours: draft.privateLessonHours ?? undefined,
        privateLessonLanguage:
          draft.privateLessonLanguage as ProgramLanguage | undefined,
        privateLessonPackageId: draft.privateLessonPackageId ?? undefined,
        programId: draft.programId,
        instructorProfileId: draft.selectedInstructorProfileId ?? undefined,
      });
      const capacityOverride =
        pricing.courseMode === 'group' &&
        pricing.atCapacity &&
        draft.capacityOverride === true;
      // Package discounts re-derive from the package row so a price change
      // between steps can't ratchet the stored value; a package that no longer
      // fits (expired, retargeted, fixed value above the new list price) drops
      // the discount entirely, forcing a step-7 revisit.
      let discountPackageId = draft.discountPackageId;
      let discount: {
        discountCents: number;
        discountType: 'none' | 'percentage' | 'fixed';
        discountValue: number;
      };

      if (discountPackageId) {
        try {
          const pkg = await resolveDraftDiscountPackage(
            transaction,
            discountPackageId,
            { branchId: draft.branchId, courseMode: draft.courseMode },
          );
          discount = {
            ...calculateDiscount(
              pricing.basePriceCents,
              pkg.discountType,
              pkg.discountValue,
            ),
            discountType: pkg.discountType,
          };
        } catch {
          discountPackageId = null;
          discount = { discountCents: 0, discountType: 'none', discountValue: 0 };
        }
      } else {
        discount = recalculateStoredDiscount(
          pricing.basePriceCents,
          draft.discountType,
          draft.discountValue,
        );
      }

      const finalPriceCents = pricing.basePriceCents - discount.discountCents;

      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          branchId:
            pricing.courseMode === 'group' ? pricing.branch.id : null,
          capacityOverride,
          capacityOverrideAt: capacityOverride ? now : null,
          capacityOverrideByUserId: capacityOverride ? principal.id : null,
          capacityOverrideNote: capacityOverride
            ? cleanOptional(draft.capacityOverrideNote ?? undefined)
            : null,
          courseMode: pricing.courseMode,
          currency: 'TRY',
          discountCents: discount.discountCents,
          discountNote:
            discount.discountCents > 0
              ? cleanOptional(draft.discountNote ?? undefined)
              : null,
          discountPackageId,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          finalPriceCents,
          listPriceCents: pricing.basePriceCents,
          privateLessonHours:
            pricing.courseMode === 'private'
              ? pricing.privateLessonHours
              : null,
          privateLessonLanguage:
            pricing.courseMode === 'private'
              ? (draft.privateLessonLanguage as ProgramLanguage)
              : null,
          privateLessonPackageId:
            pricing.courseMode === 'private'
              ? (pricing.lessonPackage?.id ?? null)
              : null,
          privateLessonRateId:
            pricing.courseMode === 'private' ? pricing.rate.id : null,
          programId: pricing.program.id,
          programReferenceId: pricing.program.id,
          programSelection: pricing.snapshot,
          selectedInstructorProfileId:
            pricing.courseMode === 'private'
              ? draft.selectedInstructorProfileId
              : null,
        })
        .where(eq(enrollmentDrafts.id, draftId));
      return {
        draft: {
          branchId:
            pricing.courseMode === 'group' ? pricing.branch.id : undefined,
          branchName:
            pricing.courseMode === 'group'
              ? pricing.branch.name
              : undefined,
          capacityOverride,
          capacityOverrideNote: capacityOverride
            ? cleanOptional(draft.capacityOverrideNote ?? undefined) ??
              undefined
            : undefined,
          courseMode: pricing.courseMode,
          discountCents: discount.discountCents,
          discountNote:
            discount.discountCents > 0
              ? cleanOptional(draft.discountNote ?? undefined) ?? undefined
              : undefined,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          finalPriceCents,
          listPriceCents: pricing.basePriceCents,
          privateLessonRateId:
            pricing.courseMode === 'private' ? pricing.rate.id : undefined,
          programLabel: pricing.snapshot.label,
          programReferenceId: pricing.program.id,
        },
      };
    }

    if (patch.step === 7) {
      if (draft.listPriceCents === null) {
        throw new PublicFlowError('program_price_missing', 409);
      }

      // Package picks are server-authoritative: the type/value come from the
      // package row, never from the client. Anything else is a MANUAL
      // discount, which requires a note (and pings admins on completion).
      let discountType = patch.data.discountType;
      let discountValueInput = patch.data.discountValue;
      let discountPackageId: string | null = null;

      if (patch.data.discountPackageId) {
        const pkg = await resolveDraftDiscountPackage(
          transaction,
          patch.data.discountPackageId,
          { branchId: draft.branchId, courseMode: draft.courseMode },
        );

        discountType = pkg.discountType;
        discountValueInput = pkg.discountValue;
        discountPackageId = pkg.id;
      } else if (patch.data.discountType !== 'none') {
        if (!cleanOptional(patch.data.discountNote)) {
          throw new PublicFlowError('discount_note_required', 400);
        }
      }

      const discount = calculateDiscount(
        draft.listPriceCents,
        discountType,
        discountValueInput,
      );
      const finalPriceCents = draft.listPriceCents - discount.discountCents;

      if (patch.data.initialPaymentCents > finalPriceCents) {
        throw new PublicFlowError('initial_payment_exceeds_price', 400);
      }

      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          currency: 'TRY',
          discountAppliedByUserId:
            discount.discountCents > 0 ? principal.id : null,
          discountCents: discount.discountCents,
          discountNote:
            discount.discountCents > 0
              ? cleanOptional(patch.data.discountNote)
              : null,
          discountPackageId:
            discount.discountCents > 0 ? discountPackageId : null,
          discountType,
          discountValue: discount.discountValue,
          finalPriceCents,
          financialNotes: cleanOptional(patch.data.financialNotes),
          initialPaymentCents: patch.data.initialPaymentCents,
          installmentCount: patch.data.installmentCount,
          paymentMethod: cleanOptional(patch.data.paymentMethod),
        })
        .where(eq(enrollmentDrafts.id, draftId));
      return {
        draft: {
          discountCents: discount.discountCents,
          discountPackageId: discountPackageId ?? undefined,
          discountType,
          discountValue: discount.discountValue,
          finalPriceCents,
        },
      };
    }

    if (patch.step === 8) {
      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          scheduleMode: patch.data.scheduleMode,
          scheduleNotes: cleanOptional(patch.data.scheduleNotes),
          schedulePreferences: patch.data.schedulePreferences,
        })
        .where(eq(enrollmentDrafts.id, draftId));
      return;
    }

    await transaction
      .update(enrollmentDrafts)
      .set({
        ...common,
        internalNotes: cleanOptional(patch.data.internalNotes),
      })
      .where(eq(enrollmentDrafts.id, draftId));
  });

  return { ...result, savedAt: now.toISOString() };
}

async function requireOpenDraft(draftId: string) {
  const [draft] = await database
    .select({ id: enrollmentDrafts.id, status: enrollmentDrafts.status })
    .from(enrollmentDrafts)
    .where(eq(enrollmentDrafts.id, draftId))
    .limit(1);
  if (!draft) {
    throw new PublicFlowError('enrollment_draft_not_found', 404);
  }
  // A completed draft is the legal record of the enrollment — its document
  // set is frozen.
  if (draft.status === 'completed') {
    throw new PublicFlowError('enrollment_draft_completed', 409);
  }
}

export async function attachEnrollmentDocument(
  principal: WorkspacePrincipal,
  draftId: string,
  input: { label: string; mediaAssetId: string; type: string },
) {
  assertAdmin(principal);
  await requireOpenDraft(draftId);

  const [asset] = await database
    .select({
      id: mediaAssets.id,
      kind: mediaAssets.kind,
      ownerUserId: mediaAssets.ownerUserId,
      status: mediaAssets.status,
      visibility: mediaAssets.visibility,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, input.mediaAssetId))
    .limit(1);

  if (
    !asset ||
    asset.ownerUserId !== principal.id ||
    asset.status !== 'ready' ||
    asset.visibility !== 'private' ||
    !['document', 'image'].includes(asset.kind)
  ) {
    throw new PublicFlowError('document_asset_invalid', 400);
  }

  const [document] = await database
    .insert(enrollmentDocuments)
    .values({
      draftId,
      label: clean(input.label),
      mediaAssetId: input.mediaAssetId,
      type: clean(input.type),
    })
    .returning({ id: enrollmentDocuments.id });

  return { id: document?.id };
}

export async function removeEnrollmentDocument(
  principal: WorkspacePrincipal,
  draftId: string,
  documentId: string,
) {
  assertAdmin(principal);
  await requireOpenDraft(draftId);
  await database
    .delete(enrollmentDocuments)
    .where(
      and(
        eq(enrollmentDocuments.id, documentId),
        eq(enrollmentDocuments.draftId, draftId),
      ),
    );
}

export async function completeEnrollment(
  principal: WorkspacePrincipal,
  draftId: string,
  locale: 'tr' | 'en' = 'tr',
  options: { closeOpenItems?: boolean } = {},
) {
  assertAdmin(principal);

  const result = await database.transaction(async (transaction) => {
    const [draft] = await transaction
      .select()
      .from(enrollmentDrafts)
      .where(eq(enrollmentDrafts.id, draftId))
      .limit(1);

    if (!draft) {
      throw new PublicFlowError('enrollment_draft_not_found', 404);
    }

    if (draft.status === 'completed') {
      const [existing] = await transaction
        .select({ id: enrollments.id, studentId: enrollments.studentId })
        .from(enrollments)
        .where(eq(enrollments.draftId, draftId))
        .limit(1);
      return existing;
    }

    if (!['draft', 'review_required', 'ready'].includes(draft.status)) {
      throw new PublicFlowError('enrollment_draft_locked', 409);
    }

    const parties = await transaction
      .select()
      .from(enrollmentParties)
      .where(eq(enrollmentParties.draftId, draftId));
    const errors = validateEnrollmentDraft(draft, parties);

    if (errors.length) {
      throw new PublicFlowError(`enrollment_incomplete:${errors.join(',')}`, 400);
    }

    if (
      draft.courseMode === 'group' &&
      draft.programId &&
      draft.branchId
    ) {
      await resolveProgramBranchSelection(transaction, {
        branchId: draft.branchId,
        capacityOverride: draft.capacityOverride,
        programId: draft.programId,
      });
    }

    const [candidate] = await transaction
      .select({
        advisorId: candidateProfiles.advisorId,
        contactId: candidateProfiles.contactId,
        id: candidateProfiles.id,
      })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, draft.candidateId))
      .limit(1);

    if (!candidate) {
      throw new PublicFlowError('candidate_not_found', 404);
    }

    const [latestAttempt] = await transaction
      .select({
        inquiryId: candidateInquiries.id,
        resultLevel: assessmentAttempts.resultLevel,
      })
      .from(candidateInquiries)
      .leftJoin(
        assessmentAttempts,
        eq(assessmentAttempts.inquiryId, candidateInquiries.id),
      )
      .where(eq(candidateInquiries.candidateId, candidate.id))
      .orderBy(desc(candidateInquiries.createdAt))
      .limit(1);

    const [existingStudent] = await transaction
      .select({ id: studentProfiles.id, userId: studentProfiles.userId })
      .from(studentProfiles)
      .where(eq(studentProfiles.candidateId, candidate.id))
      .limit(1);

    const student =
      existingStudent ??
      (
        await transaction
          .insert(studentProfiles)
          .values({
            candidateId: candidate.id,
            contactId: candidate.contactId,
            currentLevel: latestAttempt?.resultLevel,
          })
          .returning({
            id: studentProfiles.id,
            userId: studentProfiles.userId,
          })
      )[0];

    if (!student) {
      throw new Error('Student profile could not be created.');
    }

    // A real enrollment turns a trial (discovery) account into a full one —
    // the demo access window no longer applies.
    if (existingStudent) {
      await transaction
        .update(studentProfiles)
        .set({ demoExpiresAt: null, updatedAt: new Date() })
        .where(eq(studentProfiles.id, student.id));
    }

    // A returning student (account already activated) simply gets a second
    // enrollment — the invitation step only exists for brand-new accounts.
    const invitation = student.userId
      ? null
      : await createStudentAccountInvitation(transaction, {
          actorId: principal.id,
          email: draft.email!,
          locale,
          name: fullName(draft.firstName ?? '', draft.lastName ?? ''),
          studentId: student.id,
          username: draft.studentUsername!,
        });

    const [enrollment] = await transaction
      .insert(enrollments)
      .values({
        branchId: draft.branchId,
        candidateId: candidate.id,
        capacityOverride: draft.capacityOverride,
        capacityOverrideAt: draft.capacityOverrideAt,
        capacityOverrideByUserId: draft.capacityOverrideByUserId,
        capacityOverrideNote: draft.capacityOverrideNote,
        courseMode: draft.courseMode!,
        currency: 'TRY',
        draftId,
        finalPriceCents: draft.finalPriceCents!,
        financialSnapshot: {
          discountCents: draft.discountCents,
          discountAppliedByUserId: draft.discountAppliedByUserId,
          discountNote: draft.discountNote,
          discountPackageId: draft.discountPackageId,
          discountSource:
            draft.discountCents > 0
              ? draft.discountPackageId
                ? 'package'
                : 'manual'
              : null,
          discountType: draft.discountType,
          discountValue: draft.discountValue,
          financialNotes: draft.financialNotes,
          initialPaymentCents: draft.initialPaymentCents,
          installmentCount: draft.installmentCount,
          listPriceCents: draft.listPriceCents,
          paymentMethod: draft.paymentMethod,
        },
        privateLessonRateId: draft.privateLessonRateId,
        programId: draft.programId,
        programReferenceId: draft.programReferenceId,
        programSelection: draft.programSelection,
        registeredByUserId: principal.id,
        scheduleSnapshot: {
          mode: draft.scheduleMode,
          notes: draft.scheduleNotes,
          preferences: draft.schedulePreferences,
        },
        selectedInstructorProfileId: draft.selectedInstructorProfileId,
        studentId: student.id,
      })
      .returning({ id: enrollments.id });

    if (!enrollment) {
      throw new Error('Enrollment could not be created.');
    }

    // Seed the agreed installment plan from the wizard's financial step; staff
    // can reshape it later from the payments screens.
    await generateDefaultInstallmentPlan(transaction, {
      createdByUserId: principal.id,
      enrolledAt: new Date(),
      enrollmentId: enrollment.id,
      finalPriceCents: draft.finalPriceCents!,
      initialPaymentCents: draft.initialPaymentCents,
      installmentCount: draft.installmentCount,
    });

    const now = new Date();
    await transaction
      .update(enrollmentDrafts)
      .set({
        completedAt: now,
        currentStep: 9,
        lastSavedAt: now,
        status: 'completed',
        updatedAt: now,
      })
      .where(eq(enrollmentDrafts.id, draftId));
    await transaction
      .update(candidateProfiles)
      .set({ lastActivityAt: now, stage: 'enrolled', updatedAt: now })
      .where(eq(candidateProfiles.id, candidate.id));
    // Opt-in cleanup (the wizard asks first): the enrolled candidate's open
    // consultation and system work items are now moot.
    if (options.closeOpenItems) {
      await transaction
        .update(appointmentRequests)
        .set({
          outcomeNote: 'auto_closed_enrollment',
          status: 'cancelled',
          updatedAt: now,
        })
        .where(
          and(
            eq(appointmentRequests.candidateId, candidate.id),
            inArray(appointmentRequests.status, ['requested', 'scheduled']),
          ),
        );
      await transaction
        .update(advisorTasks)
        .set({
          completedAt: now,
          completedByUserId: principal.id,
          status: 'done',
          updatedAt: now,
        })
        .where(
          and(
            eq(advisorTasks.candidateId, candidate.id),
            eq(advisorTasks.status, 'open'),
            ne(advisorTasks.kind, 'manual'),
          ),
        );
    }
    if (latestAttempt?.inquiryId) {
      await transaction
        .update(candidateInquiries)
        .set({ status: 'enrolled', updatedAt: now })
        .where(eq(candidateInquiries.id, latestAttempt.inquiryId));
    }
    await transaction.insert(candidateActivities).values({
      candidateId: candidate.id,
      inquiryId: latestAttempt?.inquiryId,
      metadata: {
        branchId: draft.branchId,
        draftId,
        enrollmentId: enrollment.id,
        studentId: student.id,
      },
      occurredAt: now,
      type: 'candidate.enrollment_completed',
    });

    return {
      advisorId: candidate.advisorId,
      candidateId: candidate.id,
      id: enrollment.id,
      invitation,
      manualDiscount:
        draft.discountCents > 0 && !draft.discountPackageId
          ? { cents: draft.discountCents, note: draft.discountNote }
          : null,
      studentId: student.id,
    };
  });

  if (result && 'invitation' in result && result.invitation) {
    await enqueueStudentInvitation(result.invitation);
  }

  if (result && 'candidateId' in result) {
    // The wrap-up chase is satisfied; onboarding (welcome call, first lesson)
    // becomes the advisor's next-day work item.
    const onboardingDue = new Date();
    onboardingDue.setDate(onboardingDue.getDate() + 1);
    await closeSystemTasks(
      result.candidateId,
      ['enrollment_wrapup'],
      principal.id,
    );
    await spawnSystemTask({
      assigneeUserId: result.advisorId,
      candidateId: result.candidateId,
      dueAt: onboardingDue,
      kind: 'enrollment_onboarding',
    });

    // Off-catalog discounts are valid immediately but admins get pinged and
    // the İndirimler screen lists them flagged.
    if (result.manualDiscount) {
      await notifyManualDiscountApplied({
        appliedByName: principal.name,
        discountCents: result.manualDiscount.cents,
        enrollmentId: result.id,
        note: result.manualDiscount.note,
      });
    }
  }

  return result
    ? {
        id: result.id,
        studentId: result.studentId,
      }
    : result;
}

async function createStudentAccountInvitation(
  transaction: EnrollmentTransaction,
  input: {
    actorId: string;
    email: string;
    locale: 'tr' | 'en';
    name: string;
    studentId: string;
    username: string;
  },
): Promise<StudentInvitationDelivery> {
  const email = input.email.trim().toLocaleLowerCase('en-US');
  const username = normalizeStudentUsername(input.username);
  const now = new Date();

  await assertAccountIdentityAvailable(transaction, { email, username });

  const [profile] = await transaction
    .select({
      email: contacts.email,
      id: studentProfiles.id,
      userId: studentProfiles.userId,
    })
    .from(studentProfiles)
    .innerJoin(contacts, eq(contacts.id, studentProfiles.contactId))
    .where(eq(studentProfiles.id, input.studentId))
    .limit(1)
    .for('update');

  if (!profile || profile.userId || profile.email !== email) {
    throw new PublicFlowError('student_invitation_unavailable', 409);
  }

  const [pendingStudentInvitation] = await transaction
    .select({ id: userInvitations.id })
    .from(studentAccountInvitations)
    .innerJoin(
      userInvitations,
      eq(userInvitations.id, studentAccountInvitations.invitationId),
    )
    .where(
      and(
        eq(studentAccountInvitations.studentId, input.studentId),
        eq(userInvitations.status, 'pending'),
        gt(userInvitations.expiresAt, now),
      ),
    )
    .limit(1);

  if (pendingStudentInvitation) {
    throw new PublicFlowError('invitation_already_pending', 409);
  }

  const { hash, token } = createOpaqueToken();
  const expiresAt = new Date(Date.now() + STUDENT_INVITATION_TTL_MS);
  const [invitation] = await transaction
    .insert(userInvitations)
    .values({
      email,
      expiresAt,
      invitedByUserId: input.actorId,
      name: input.name,
      role: 'student',
      tokenHash: hash,
      username,
    })
    .returning({
      expiresAt: userInvitations.expiresAt,
      id: userInvitations.id,
      username: userInvitations.username,
    });

  if (!invitation) {
    throw new Error('Student invitation could not be created.');
  }

  await transaction.insert(studentAccountInvitations).values({
    invitationId: invitation.id,
    studentId: input.studentId,
  });

  return {
    email,
    expiresAt: invitation.expiresAt,
    id: invitation.id,
    locale: input.locale,
    name: input.name,
    token,
    username: invitation.username,
  };
}

async function enqueueStudentInvitation(invitation: StudentInvitationDelivery) {
  const activationUrl = new URL(
    `/${invitation.locale}/aktivasyon`,
    getAuthEnv().APP_URL,
  );
  activationUrl.searchParams.set('token', invitation.token);

  await notificationService.enqueue({
    channel: 'email',
    idempotencyKey: `invitation:${invitation.id}`,
    locale: invitation.locale,
    payload: {
      expiresAt: invitation.expiresAt.toISOString(),
      name: invitation.name,
      username: invitation.username,
    },
    recipient: invitation.email,
    sensitivePayload: {
      activationUrl: activationUrl.toString(),
    },
    templateKey: 'account-invitation',
  });
}

async function assertAccountIdentityAvailable(
  transaction: EnrollmentTransaction,
  input: { email: string; username: string },
) {
  const now = new Date();
  const [duplicateEmail] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (duplicateEmail) {
    throw new PublicFlowError('invitation_email_already_registered', 409);
  }

  const [duplicateUsername] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (duplicateUsername) {
    throw new PublicFlowError('username_already_registered', 409);
  }

  const [pendingEmailInvitation] = await transaction
    .select({ id: userInvitations.id })
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.email, input.email),
        eq(userInvitations.status, 'pending'),
        gt(userInvitations.expiresAt, now),
      ),
    )
    .limit(1);

  if (pendingEmailInvitation) {
    throw new PublicFlowError('invitation_already_pending', 409);
  }

  const [pendingUsernameInvitation] = await transaction
    .select({ id: userInvitations.id })
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.username, input.username),
        eq(userInvitations.status, 'pending'),
        gt(userInvitations.expiresAt, now),
      ),
    )
    .limit(1);

  if (pendingUsernameInvitation) {
    throw new PublicFlowError('invitation_username_already_pending', 409);
  }
}

function normalizeStudentUsername(value: string) {
  try {
    return assertValidUsername(value);
  } catch {
    throw new PublicFlowError('invalid_username', 400);
  }
}

function validateEnrollmentDraft(
  draft: typeof enrollmentDrafts.$inferSelect,
  parties: Array<typeof enrollmentParties.$inferSelect>,
) {
  const errors: string[] = [];
  const required = [
    ['first_name', draft.firstName],
    ['last_name', draft.lastName],
    ['phone', draft.primaryPhone],
    ['email', draft.email],
    ['student_username', draft.studentUsername],
    ['address', draft.residenceAddress],
    ['course_mode', draft.courseMode],
    ['program_id', draft.programId],
    ['program', draft.programSelection.label],
    ['registration_channel', draft.registrationChannel],
  ] as const;

  for (const [key, value] of required) {
    if (!value) errors.push(key);
  }

  if (draft.courseMode === 'group' && !draft.branchId) {
    errors.push('program_branch');
  }

  if (draft.finalPriceCents === null || draft.listPriceCents === null) {
    errors.push('financial_plan');
  } else if (
    draft.finalPriceCents < draft.initialPaymentCents ||
    draft.finalPriceCents > draft.listPriceCents ||
    draft.finalPriceCents !== draft.listPriceCents - draft.discountCents
  ) {
    errors.push('financial_totals');
  }

  if (
    draft.courseMode === 'private' &&
    (!draft.selectedInstructorProfileId ||
      !draft.privateLessonLanguage ||
      !draft.privateLessonHours ||
      !draft.privateLessonRateId)
  ) {
    errors.push('private_lesson_selection');
  }

  if (!draft.studentIsContractParty) {
    const hasResponsibleParty = parties.some((party) =>
      party.roles.some((role) =>
        ['payer', 'promissory_debtor'].includes(role),
      ),
    );
    if (!hasResponsibleParty) errors.push('contract_party');
  }

  if (draft.birthDate && isMinor(draft.birthDate)) {
    const hasGuardian = parties.some((party) =>
      party.roles.includes('guardian'),
    );
    if (!hasGuardian) errors.push('guardian');
  }

  return errors;
}

function assertAdmin(principal: WorkspacePrincipal) {
  // Staff scope: advisors run the same CRM/enrollment flows as admins.
  if (principal.role !== 'admin' && principal.role !== 'advisor') {
    throw new AuthorizationDeniedError('Staff access is required.');
  }
}

function parseDateOnly(value?: string) {
  const cleaned = cleanOptional(value);
  if (!cleaned) {
    return null;
  }
  if (!isValidBirthDate(cleaned)) {
    throw new PublicFlowError('invalid_birth_date', 400);
  }
  return cleaned;
}

function isMinor(birthDate: string) {
  const age = ageOnDate(birthDate);
  return age !== undefined && age < 18;
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim() || 'Student';
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function cleanOptional(value?: string) {
  const cleaned = value ? clean(value) : '';
  return cleaned || null;
}

function calculateDiscount(
  listPriceCents: number,
  type: 'none' | 'percentage' | 'fixed',
  rawValue: number,
) {
  const value = Math.max(0, Math.trunc(rawValue));

  if (type === 'none') {
    return { discountCents: 0, discountValue: 0 };
  }

  if (type === 'percentage') {
    if (value > 10_000) {
      throw new PublicFlowError('discount_percentage_invalid', 400);
    }
    return {
      discountCents: Math.round((listPriceCents * value) / 10_000),
      discountValue: value,
    };
  }

  if (value > listPriceCents) {
    throw new PublicFlowError('discount_exceeds_price', 400);
  }

  return { discountCents: value, discountValue: value };
}

function recalculateStoredDiscount(
  listPriceCents: number,
  type: 'none' | 'percentage' | 'fixed',
  rawValue: number,
) {
  const value = Math.max(0, Math.trunc(rawValue));

  if (type === 'percentage') {
    const discountValue = Math.min(10_000, value);
    return {
      discountCents: Math.round((listPriceCents * discountValue) / 10_000),
      discountType: type,
      discountValue,
    };
  }

  if (type === 'fixed') {
    const discountValue = Math.min(listPriceCents, value);
    return {
      discountCents: discountValue,
      discountType: type,
      discountValue,
    };
  }

  return {
    discountCents: 0,
    discountType: 'none' as const,
    discountValue: 0,
  };
}
