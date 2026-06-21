import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
  ExternalIdentityError,
  MediaQuotaExceededError,
  PayloadTooLargeError,
  PublicFlowError,
  UnsafeMediaError,
  UnsupportedMediaTypeError,
} from '@/lib/server/http/errors';

export function requestId(request: Request) {
  const supplied = request.headers.get('x-request-id')?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{1,64}$/.test(supplied)
    ? supplied
    : randomUUID();
}

export function apiErrorResponse(error: unknown, id: string) {
  if (error instanceof AuthenticationRequiredError) {
    return response('unauthorized', 401, id);
  }

  if (error instanceof AuthorizationDeniedError) {
    return response('forbidden', 403, id);
  }

  if (error instanceof ExternalIdentityError) {
    return response('identity_operation_failed', 409, id);
  }

  if (error instanceof PublicFlowError) {
    return response(error.code, error.status, id);
  }

  if (error instanceof PayloadTooLargeError) {
    return response('payload_too_large', 413, id);
  }

  if (error instanceof MediaQuotaExceededError) {
    return response('media_quota_exceeded', 413, id);
  }

  if (error instanceof UnsupportedMediaTypeError) {
    return response('unsupported_media_type', 415, id);
  }

  if (error instanceof UnsafeMediaError) {
    return response('upload_rejected', 422, id);
  }

  if (error instanceof SyntaxError) {
    return response('invalid_request', 400, id);
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  ) {
    return response('conflict', 409, id);
  }

  console.error(
    JSON.stringify({
      errorCode:
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code).slice(0, 64)
          : undefined,
      errorType: error instanceof Error ? error.name : typeof error,
      event: 'api.request_failed',
      requestId: id,
      timestamp: new Date().toISOString(),
    }),
  );

  return response('internal_error', 500, id);
}

export function apiResponse(
  body: Record<string, unknown>,
  status: number,
  id: string,
) {
  return NextResponse.json(body, {
    headers: { 'X-Request-ID': id },
    status,
  });
}

function response(error: string, status: number, id: string) {
  return apiResponse({ error }, status, id);
}
