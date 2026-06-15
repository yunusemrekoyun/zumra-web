import { isValidIdentityDocument } from './identity';
import { phoneNumberIsValid } from './phone';

export type EnrollmentFieldErrors = Record<string, string>;

export type EnrollmentValidationMessages = {
  address: string;
  birthDate: string;
  birthLocation: string;
  branch: string;
  email: string;
  firstName: string;
  gender: string;
  guardian: string;
  identity: string;
  initialPayment: string;
  lastName: string;
  phone: string;
  privateLesson: string;
  program: string;
  registrationChannel: string;
  school: string;
};

type PartyLike = {
  roles: string[];
};

type DraftLike = {
  birthAdministrativeArea?: string;
  birthCountryCode?: string;
  birthDate?: string;
  birthLocality?: string;
  branchId?: string;
  courseMode?: 'group' | 'private';
  email: string;
  finalPriceCents?: number;
  firstName: string;
  gender?: string;
  identityDocument: string;
  identityDocumentMasked?: string;
  identityDocumentType?: 'national_id' | 'passport';
  initialPaymentCents: number;
  lastName: string;
  listPriceCents?: number;
  primaryPhone: string;
  privateLessonHours?: number;
  privateLessonLanguage?: string;
  privateLessonRateId?: string;
  programReferenceId?: string;
  registrationChannel?: string;
  residenceAddress: string;
  school?: string;
  selectedInstructorProfileId?: string;
};

export function parseDateOnly(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }
  return parsed;
}

export function isValidBirthDate(value?: string, today = new Date()) {
  const birthDate = parseDateOnly(value);
  if (!birthDate) return false;
  const todayDate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );
  return birthDate <= todayDate;
}

export function ageOnDate(value: string, today = new Date()) {
  const birthDate = parseDateOnly(value);
  if (!birthDate) return undefined;
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

export function validateEnrollmentStep(
  step: number,
  draft: DraftLike,
  parties: PartyLike[],
  isMinor: boolean,
  messages: EnrollmentValidationMessages,
) {
  const errors: EnrollmentFieldErrors = {};

  if (step === 1) {
    const identityType = draft.identityDocumentType ?? 'national_id';
    if (
      !draft.identityDocumentMasked &&
      !isValidIdentityDocument(identityType, draft.identityDocument)
    ) {
      errors.identityDocument = messages.identity;
    }
    if (draft.firstName.trim().length < 2) {
      errors.firstName = messages.firstName;
    }
    if (draft.lastName.trim().length < 2) {
      errors.lastName = messages.lastName;
    }
    if (!draft.birthCountryCode) {
      errors.birthCountryCode = messages.birthLocation;
    }
    if (!draft.birthAdministrativeArea?.trim()) {
      errors.birthAdministrativeArea = messages.birthLocation;
    }
    if (!draft.birthLocality?.trim()) {
      errors.birthLocality = messages.birthLocation;
    }
    if (!isValidBirthDate(draft.birthDate)) {
      errors.birthDate = messages.birthDate;
    }
    if (!draft.gender) {
      errors.gender = messages.gender;
    }
    if (!draft.school?.trim()) {
      errors.school = messages.school;
    }
  }

  if (step === 2) {
    if (!phoneNumberIsValid(draft.primaryPhone)) {
      errors.primaryPhone = messages.phone;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      errors.email = messages.email;
    }
    if (draft.residenceAddress.trim().length < 8) {
      errors.residenceAddress = messages.address;
    }
    if (isMinor && !parties.some((party) => party.roles.includes('guardian'))) {
      errors.guardian = messages.guardian;
    }
  }

  if (step === 3) {
    if (!draft.programReferenceId) {
      errors.programReferenceId = messages.program;
    } else if (draft.courseMode === 'group' && !draft.branchId) {
      errors.branchId = messages.branch;
    } else if (
      draft.courseMode === 'private' &&
      (!draft.privateLessonLanguage ||
        !draft.selectedInstructorProfileId ||
        !draft.privateLessonHours ||
        !draft.privateLessonRateId)
    ) {
      errors.privateLesson = messages.privateLesson;
    }
  }

  if (step === 5 && !draft.registrationChannel) {
    errors.registrationChannel = messages.registrationChannel;
  }

  if (
    step === 7 &&
    (draft.listPriceCents === undefined ||
      draft.finalPriceCents === undefined ||
      draft.initialPaymentCents > draft.finalPriceCents)
  ) {
    errors.initialPaymentCents = messages.initialPayment;
  }

  return errors;
}
