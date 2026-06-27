import 'server-only';

import { isIP } from 'node:net';
import { getAuthEnv } from '@/lib/server/env';

const PRIVATE_METADATA_KEY =
  /(password|cookie|authorization|token|otp|secret|connection.?string|private.?key|access.?key)/i;
const MAX_METADATA_DEPTH = 5;
const MAX_METADATA_ITEMS = 50;
const MAX_METADATA_STRING_LENGTH = 500;

export function maskIp(ip?: string | null) {
  if (!ip) {
    return undefined;
  }

  const normalized = ip.trim().split('%', 1)[0];
  const version = isIP(normalized);

  if (version === 6) {
    const blocks = expandIpv6(normalized);

    if (!blocks) {
      return 'masked';
    }

    return `${formatIpv6([
      ...blocks.slice(0, 3),
      0,
      0,
      0,
      0,
      0,
    ])}/48`;
  }

  const octets = normalized.split('.');
  return version === 4
    ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24`
    : 'masked';
}

function expandIpv6(ip: string) {
  let normalized = ip.toLowerCase();

  if (normalized.includes('.')) {
    const separator = normalized.lastIndexOf(':');
    const ipv4 = normalized.slice(separator + 1).split('.').map(Number);

    if (
      separator < 0 ||
      ipv4.length !== 4 ||
      ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return null;
    }

    normalized = `${normalized.slice(0, separator)}:${(
      (ipv4[0] << 8) |
      ipv4[1]
    ).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }

  const halves = normalized.split('::');

  if (halves.length > 2) {
    return null;
  }

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;

  if (
    (halves.length === 1 && missing !== 0) ||
    (halves.length === 2 && missing < 1)
  ) {
    return null;
  }

  const blocks = [
    ...left,
    ...Array.from({ length: missing }, () => '0'),
    ...right,
  ].map((block) => Number.parseInt(block, 16));

  return blocks.length === 8 &&
    blocks.every((block) => Number.isInteger(block) && block >= 0 && block <= 0xffff)
    ? blocks
    : null;
}

function formatIpv6(blocks: number[]) {
  let bestStart = -1;
  let bestLength = 0;

  for (let start = 0; start < blocks.length; start += 1) {
    if (blocks[start] !== 0) {
      continue;
    }

    let end = start;

    while (end < blocks.length && blocks[end] === 0) {
      end += 1;
    }

    if (end - start > bestLength) {
      bestStart = start;
      bestLength = end - start;
    }

    start = end - 1;
  }

  const values = blocks.map((block) => block.toString(16));

  if (bestLength < 2) {
    return values.join(':');
  }

  const before = values.slice(0, bestStart).join(':');
  const after = values.slice(bestStart + bestLength).join(':');
  return `${before}::${after}`;
}

export function redactMetadata(
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  return sanitizeMetadataObject(metadata, 0, new WeakSet());
}

function sanitizeMetadataObject(
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  if (depth >= MAX_METADATA_DEPTH || seen.has(value)) {
    return {};
  }

  seen.add(value);
  const entries = Object.entries(value)
    .slice(0, MAX_METADATA_ITEMS)
    .map(([key, child]) => [
      key,
      PRIVATE_METADATA_KEY.test(key)
        ? '[REDACTED]'
        : sanitizeMetadataValue(child, depth + 1, seen),
    ]);
  seen.delete(value);
  return Object.fromEntries(entries);
}

function sanitizeMetadataValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_METADATA_STRING_LENGTH
      ? `${value.slice(0, MAX_METADATA_STRING_LENGTH)}...`
      : value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_METADATA_DEPTH || seen.has(value)) {
      return [];
    }

    seen.add(value);
    const sanitized = value
      .slice(0, MAX_METADATA_ITEMS)
      .map((item) => sanitizeMetadataValue(item, depth + 1, seen));
    seen.delete(value);
    return sanitized;
  }

  if (value && typeof value === 'object') {
    return sanitizeMetadataObject(
      value as Record<string, unknown>,
      depth,
      seen,
    );
  }

  return value;
}

export function requestIp(headers: Headers) {
  const nginxIp = headers.get('x-real-ip')?.trim();

  if (getAuthEnv().NODE_ENV === 'production') {
    return nginxIp || undefined;
  }

  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return nginxIp || forwarded || undefined;
}

export function isTrustedRequestOrigin(headers: Headers) {
  const origin = headers.get('origin');

  if (!origin) {
    return false;
  }

  try {
    const env = getAuthEnv();
    const allowedOrigins = new Set<string>();
    for (const base of [env.APP_URL, env.BETTER_AUTH_URL]) {
      const url = new URL(base);
      allowedOrigins.add(url.origin);
      // Also trust the www. subdomain — the demo nginx serves both apex and www.
      if (!url.hostname.startsWith('www.')) {
        url.hostname = `www.${url.hostname}`;
        allowedOrigins.add(url.origin);
      }
    }
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
