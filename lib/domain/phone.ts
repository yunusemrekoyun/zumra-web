import {
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export function normalizePhoneNumber(
  value: string,
  defaultCountry: CountryCode = 'TR',
) {
  const cleaned = value.trim();
  if (!cleaned) return '';

  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (parsed?.isValid()) {
    return parsed.number;
  }

  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  const callingCode = getCountryCallingCode(defaultCountry);
  return cleaned.startsWith('+')
    ? `+${digits}`
    : `+${callingCode}${digits.replace(/^0+/, '')}`;
}

export function phoneNumberIsValid(value: string) {
  try {
    return Boolean(value) && isValidPhoneNumber(value);
  } catch {
    return false;
  }
}

