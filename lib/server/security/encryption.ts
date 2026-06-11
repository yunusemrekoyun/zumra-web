import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { getOutboxEnv } from '@/lib/server/env';

const VERSION = 'v1';

function encryptionKey() {
  return createHash('sha256')
    .update(`zumra-outbox:${getOutboxEnv().OUTBOX_ENCRYPTION_SECRET}`)
    .digest();
}

export function encryptJson(value: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptJson(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.');

  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Unsupported encrypted payload.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>;
}
