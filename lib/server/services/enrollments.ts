import 'server-only';

import { and, desc, eq, inArray } from 'drizzle-orm';
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
  assessmentAttempts,
  candidateActivities,
  candidateInquiries,
  candidateProfiles,
  contacts,
  enrollmentDocuments,
  enrollmentDrafts,
  enrollmentParties,
  enrollments,
  mediaAssets,
  studentProfiles,
  users,
} from '@/lib/server/db/schema';
import { AuthorizationDeniedError, PublicFlowError } from '@/lib/server/http/errors';
import {
  maskIdentityDocument,
  protectIdentityDocument,
} from '@/lib/server/security/identity';
import {
  type ProgramLanguage,
  resolveProgramBranchSelection,
  resolveProgramPricing,
} from '@/lib/server/services/programs';

type IdentityDocumentType = 'national_id' | 'passport';
type GenderIdentity =
  | 'female'
  | 'male'
  | 'non_binary'
  | 'other'
  | 'prefer_not_to_say';
type PartyRelationship = 'mother' | 'father' | 'sibling' | 'other';
type PartyRole = 'guardian' | 'payer' | 'promissory_debtor' | 'other';

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
        birthAdministrativeArea: string;
        birthCountryCode: string;
        birthDate: string;
        birthLocality: string;
        firstName: string;
        gender: GenderIdentity;
        identityDocument?: string;
        identityDocumentType: IdentityDocumentType;
        lastName: string;
        school: string;
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

export async function beginEnrollmentDraft(
  principal: WorkspacePrincipal,
  candidateId: string,
) {
  assertAdmin(principal);

  return database.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select({
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
      return { created: false, id: existing.id };
    }

    const [draft] = await transaction
      .insert(enrollmentDrafts)
      .values({
        candidateId,
        createdByUserId: principal.id,
        email: candidate.email,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        primaryPhone: candidate.phone,
      })
      .returning({ id: enrollmentDrafts.id });

    if (!draft) {
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

    return { created: true, id: draft.id };
  });
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
    })
    .from(enrollmentDrafts)
    .innerJoin(
      candidateProfiles,
      eq(candidateProfiles.id, enrollmentDrafts.candidateId),
    )
    .innerJoin(contacts, eq(contacts.id, candidateProfiles.contactId))
    .innerJoin(users, eq(users.id, enrollmentDrafts.createdByUserId))
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
      primaryPhone: row.draftPrimaryPhone ?? row.phone ?? '',
      privateLessonHours: row.privateLessonHours ?? undefined,
      privateLessonLanguage:
        (row.privateLessonLanguage as ProgramLanguage | null) ?? undefined,
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
        listPriceCents: enrollmentDrafts.listPriceCents,
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
      if (
        !/^[A-Z]{2}$/.test(patch.data.birthCountryCode.toUpperCase()) ||
        !clean(patch.data.birthAdministrativeArea) ||
        !clean(patch.data.birthLocality)
      ) {
        throw new PublicFlowError('invalid_birth_location', 400);
      }
      const identity = patch.data.identityDocument
        ? protectIdentityDocument(
            patch.data.identityDocumentType,
            patch.data.identityDocument,
          )
        : null;

      if (!identity && !draft.identityDocumentEncrypted) {
        throw new PublicFlowError('identity_document_required', 400);
      }

      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          birthAdministrativeArea: clean(
            patch.data.birthAdministrativeArea,
          ),
          birthCountryCode: patch.data.birthCountryCode.toUpperCase(),
          birthDate: parseDateOnly(patch.data.birthDate),
          birthLocality: clean(patch.data.birthLocality),
          birthPlace: [
            clean(patch.data.birthLocality),
            clean(patch.data.birthAdministrativeArea),
            patch.data.birthCountryCode.toUpperCase(),
          ].join(', '),
          firstName: clean(patch.data.firstName),
          gender: patch.data.gender,
          identityDocumentBlindIndex: identity?.blindIndex,
          identityDocumentEncrypted: identity?.encrypted,
          identityDocumentLastFour: identity?.lastFour,
          identityDocumentType:
            identity?.normalized
              ? patch.data.identityDocumentType
              : draft.identityDocumentType,
          lastName: clean(patch.data.lastName),
          school: clean(patch.data.school),
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

      await transaction
        .update(enrollmentDrafts)
        .set({
          ...common,
          email: normalizedEmail,
          primaryPhone,
          residenceAddress: clean(patch.data.residenceAddress),
          secondaryPhone,
          studentIsContractParty: patch.data.studentIsContractParty,
        })
        .where(eq(enrollmentDrafts.id, draftId));

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
          discountType: 'none',
          discountValue: 0,
          finalPriceCents: pricing.basePriceCents,
          instagramHandle: cleanOptional(patch.data.instagramHandle),
          listPriceCents: pricing.basePriceCents,
          privateLessonHours:
            pricing.courseMode === 'private'
              ? patch.data.privateLessonHours
              : null,
          privateLessonLanguage:
            pricing.courseMode === 'private'
              ? patch.data.privateLessonLanguage
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
      await transaction
        .update(enrollmentDrafts)
        .set(common)
        .where(eq(enrollmentDrafts.id, draftId));
      return;
    }

    if (patch.step === 7) {
      if (draft.listPriceCents === null) {
        throw new PublicFlowError('program_price_missing', 409);
      }
      const discount = calculateDiscount(
        draft.listPriceCents,
        patch.data.discountType,
        patch.data.discountValue,
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
          discountType: patch.data.discountType,
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
          discountType: patch.data.discountType,
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

export async function attachEnrollmentDocument(
  principal: WorkspacePrincipal,
  draftId: string,
  input: { label: string; mediaAssetId: string; type: string },
) {
  assertAdmin(principal);

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
) {
  assertAdmin(principal);

  return database.transaction(async (transaction) => {
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
      .select({ id: studentProfiles.id })
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
          .returning({ id: studentProfiles.id })
      )[0];

    if (!student) {
      throw new Error('Student profile could not be created.');
    }

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

    return { id: enrollment.id, studentId: student.id };
  });
}

function validateEnrollmentDraft(
  draft: typeof enrollmentDrafts.$inferSelect,
  parties: Array<typeof enrollmentParties.$inferSelect>,
) {
  const errors: string[] = [];
  const required = [
    ['identity', draft.identityDocumentEncrypted],
    ['first_name', draft.firstName],
    ['last_name', draft.lastName],
    ['birth_date', draft.birthDate],
    ['birth_country', draft.birthCountryCode],
    ['birth_administrative_area', draft.birthAdministrativeArea],
    ['birth_locality', draft.birthLocality],
    ['gender', draft.gender],
    ['school', draft.school],
    ['phone', draft.primaryPhone],
    ['email', draft.email],
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
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

function parseDateOnly(value: string) {
  if (!isValidBirthDate(value)) {
    throw new PublicFlowError('invalid_birth_date', 400);
  }
  return value;
}

function isMinor(birthDate: string) {
  const age = ageOnDate(birthDate);
  return age !== undefined && age < 18;
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
