import 'server-only';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookiesAreSecure, getAuthEnv } from '@/lib/server/env';

function signature(deviceId: string) {
  return createHmac('sha256', getAuthEnv().DEVICE_COOKIE_SECRET)
    .update(deviceId)
    .digest('base64url');
}

export function createDeviceCookieValue() {
  const deviceId = randomUUID();
  return `${deviceId}.${signature(deviceId)}`;
}

export function isValidDeviceCookie(value: string) {
  const separator = value.lastIndexOf('.');

  if (separator <= 0) {
    return false;
  }

  const deviceId = value.slice(0, separator);
  const provided = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(signature(deviceId));

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function deviceCookieName() {
  return cookiesAreSecure() ? '__Host-zumra.device' : 'zumra.device';
}
