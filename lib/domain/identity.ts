export type IdentityDocumentType = 'national_id' | 'passport';

export function normalizeIdentityDocument(
  type: IdentityDocumentType,
  value: string,
) {
  return type === 'national_id'
    ? value.replace(/\D/g, '')
    : value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isValidIdentityDocument(
  type: IdentityDocumentType,
  value: string,
) {
  const normalized = normalizeIdentityDocument(type, value);

  if (type === 'passport') {
    return /^[A-Z0-9]{5,20}$/.test(normalized);
  }

  if (!/^[1-9]\d{10}$/.test(normalized)) {
    return false;
  }

  const digits = normalized.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = ((oddSum * 7 - evenSum) % 10 + 10) % 10;
  const eleventh =
    digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9] === tenth && digits[10] === eleventh;
}

