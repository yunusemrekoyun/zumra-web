import { describe, expect, it } from 'vitest';
import {
  ageOnDate,
  isValidBirthDate,
  validateEnrollmentStep,
} from '@/lib/domain/enrollment-validation';
import {
  isValidIdentityDocument,
  normalizeIdentityDocument,
} from '@/lib/domain/identity';
import {
  normalizePhoneNumber,
  phoneNumberIsValid,
} from '@/lib/domain/phone';
import { appendUniqueTag } from '@/lib/domain/tags';

const messages = {
  address: 'address',
  birthDate: 'birthDate',
  birthLocation: 'birthLocation',
  branch: 'branch',
  email: 'email',
  firstName: 'firstName',
  gender: 'gender',
  guardian: 'guardian',
  identity: 'identity',
  initialPayment: 'initialPayment',
  lastName: 'lastName',
  phone: 'phone',
  privateLesson: 'privateLesson',
  program: 'program',
  registrationChannel: 'registrationChannel',
  school: 'school',
};

describe('enrollment form domain rules', () => {
  it('normalizes and validates identity documents', () => {
    expect(normalizeIdentityDocument('national_id', '100 000 001 46')).toBe(
      '10000000146',
    );
    expect(isValidIdentityDocument('national_id', '10000000146')).toBe(true);
    expect(isValidIdentityDocument('national_id', '10000000145')).toBe(false);
    expect(normalizeIdentityDocument('passport', ' u 12-34 56 ')).toBe(
      'U123456',
    );
    expect(isValidIdentityDocument('passport', 'U123456')).toBe(true);
    expect(isValidIdentityDocument('passport', 'A12')).toBe(false);
  });

  it('stores international phone numbers in E.164 form', () => {
    const phone = normalizePhoneNumber('0532 123 45 67');
    expect(phone).toBe('+905321234567');
    expect(phoneNumberIsValid(phone)).toBe(true);
    expect(phoneNumberIsValid('+90123')).toBe(false);
  });

  it('validates date-only birth dates and calculates age predictably', () => {
    const today = new Date('2026-06-15T10:00:00Z');
    expect(isValidBirthDate('2000-02-29', today)).toBe(true);
    expect(isValidBirthDate('2027-01-01', today)).toBe(false);
    expect(isValidBirthDate('2026-02-30', today)).toBe(false);
    expect(ageOnDate('2008-06-16', today)).toBe(17);
    expect(ageOnDate('2008-06-15', today)).toBe(18);
  });

  it('returns a field-level error map for the current step', () => {
    const errors = validateEnrollmentStep(
      1,
      {
        birthAdministrativeArea: '',
        birthCountryCode: 'TR',
        birthDate: '2027-01-01',
        birthLocality: '',
        email: '',
        firstName: '',
        identityDocument: '123',
        identityDocumentType: 'passport',
        initialPaymentCents: 0,
        lastName: '',
        primaryPhone: '',
        residenceAddress: '',
      },
      [],
      false,
      messages,
    );

    expect(errors).toMatchObject({
      birthAdministrativeArea: 'birthLocation',
      birthDate: 'birthDate',
      birthLocality: 'birthLocation',
      firstName: 'firstName',
      identityDocument: 'identity',
      lastName: 'lastName',
      school: 'school',
    });
  });

  it('adds tags with case-insensitive duplicate and length protection', () => {
    const first = appendUniqueTag([], '  Konuşma  ');
    expect(first).toEqual(['Konuşma']);
    expect(appendUniqueTag(first, 'konuşma')).toBe(first);
    expect(appendUniqueTag(first, 'x'.repeat(101))).toBe(first);
    expect(appendUniqueTag(first, 'Sınav Hazırlığı')).toEqual([
      'Konuşma',
      'Sınav Hazırlığı',
    ]);
  });
});
