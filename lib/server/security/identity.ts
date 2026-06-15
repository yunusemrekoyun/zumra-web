import 'server-only';

import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import {
  isValidIdentityDocument,
  normalizeIdentityDocument,
} from '@/lib/domain/identity';
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

export { isValidIdentityDocument, normalizeIdentityDocument };

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
