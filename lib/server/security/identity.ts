import 'server-only';

import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { getIdentityEnv } from '@/lib/server/env';

const VERSION = 'v1';

function encryptionKey() {
  return createHash('sha256')
    .update(`zumra-identity-encryption:${getIdentityEnv().IDENTITY_ENCRYPTION_SECRET}`)
    .digest();
}

function blindIndexKey() {
  return createHash('sha256')
    .update(`zumra-identity-index:${getIdentityEnv().IDENTITY_ENCRYPTION_SECRET}`)
    .digest();
}

export function protectIdentityDocument(
  type: 'national_id' | 'passport',
  value: string,
) {
  const normalized = normalizeIdentityDocument(type, value);

  if (!isValidIdentityDocument(type, normalized)) {
    throw new Error('Identity document is invalid.');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    blindIndex: createHmac('sha256', blindIndexKey())
      .update(`${type}:${normalized}`)
      .digest('hex'),
    encrypted: [
      VERSION,
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.'),
    lastFour: normalized.slice(-4),
    normalized,
  };
}

export function normalizeIdentityDocument(
  type: 'national_id' | 'passport',
  value: string,
) {
  return type === 'national_id'
    ? value.replace(/\D/g, '')
    : value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isValidIdentityDocument(
  type: 'national_id' | 'passport',
  value: string,
) {
  if (type === 'passport') {
    return /^[A-Z0-9]{5,20}$/.test(value);
  }

  if (!/^[1-9]\d{10}$/.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = ((oddSum * 7 - evenSum) % 10 + 10) % 10;
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return digits[9] === tenth && digits[10] === eleventh;
}

export function maskIdentityDocument(
  type: 'national_id' | 'passport' | null,
  lastFour: string | null,
) {
  if (!type || !lastFour) {
    return null;
  }

  return type === 'national_id'
    ? `*******${lastFour}`
    : `****${lastFour}`;
}
