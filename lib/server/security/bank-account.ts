import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { isValidTurkishIban, normalizeIban } from '@/lib/domain/iban';
import { getIdentityEnv } from '@/lib/server/env';

const VERSION = 'v1';

// Reuses IDENTITY_ENCRYPTION_SECRET with bank-specific domain separation so no
// new environment variable is needed; keys still differ from the identity ones.
function encryptionKey() {
  return createHash('sha256')
    .update(`zumra-bank-encryption:${getIdentityEnv().IDENTITY_ENCRYPTION_SECRET}`)
    .digest();
}

function blindIndexKey() {
  return createHash('sha256')
    .update(`zumra-bank-index:${getIdentityEnv().IDENTITY_ENCRYPTION_SECRET}`)
    .digest();
}

export function protectIban(value: string) {
  const normalized = normalizeIban(value);

  if (!isValidTurkishIban(normalized)) {
    throw new Error('IBAN is invalid.');
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
      .update(`iban:${normalized}`)
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

/** Decrypts a stored IBAN for the few places that must show the full number. */
export function decryptIban(payload: string) {
  const [version, iv, tag, ciphertext] = payload.split('.');

  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Encrypted IBAN payload is malformed.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
