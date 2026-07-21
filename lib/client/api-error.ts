'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Turn a failed API `Response` into the stable error `code` string the server
 * returns as `{ error: "<code>" }`. Falls back to a status-derived code so the
 * caller always gets something mappable (never an empty/undefined message).
 */
export async function readApiErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (typeof body?.error === 'string' && body.error) return body.error;
  } catch {
    // no / non-JSON body — fall through to status mapping
  }
  if (response.status === 401) return 'unauthorized';
  if (response.status === 403) return 'forbidden';
  if (response.status === 429) return 'rate_limited';
  if (response.status === 413) return 'payload_too_large';
  if (response.status >= 500) return 'internal_error';
  return 'default';
}

/** Same as readApiErrorCode but for an already-parsed body + status. */
export function errorCodeFromBody(
  body: { error?: unknown } | null | undefined,
  status?: number,
): string {
  if (typeof body?.error === 'string' && body.error) return body.error;
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status && status >= 500) return 'internal_error';
  return 'default';
}

/**
 * Resolver hook that maps an API error code to a friendly, localized message
 * from the shared `errors` namespace, falling back to a generic string for any
 * unmapped code. Usage:
 *
 *   const errorText = useApiErrorText();
 *   if (!res.ok) setError(errorText(await readApiErrorCode(res)));
 */
export function useApiErrorText() {
  const t = useTranslations('errors');
  return useCallback(
    (code?: string | null) =>
      code && t.has(code as never) ? t(code as never) : t('default'),
    [t],
  );
}
