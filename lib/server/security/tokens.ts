import 'server-only';

import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export function createOpaqueToken(bytes = 32) {
  const token = randomBytes(bytes).toString('base64url');

  return {
    hash: hashToken(token),
    token,
  };
}

export function createNumericOtp(length = 6) {
  if (!Number.isInteger(length) || length < 1 || length > 9) {
    throw new RangeError('OTP length must be between 1 and 9 digits.');
  }

  const upperBound = 10 ** length;
  const value = randomInt(0, upperBound);
  return value.toString().padStart(length, '0');
}

export function hashToken(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeTokenEqual(value: string, expectedHash: string) {
  const actual = Buffer.from(hashToken(value), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
