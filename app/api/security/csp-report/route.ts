import { NextResponse } from 'next/server';
import { requestId } from '@/lib/server/http/api-errors';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { auditService } from '@/lib/server/services/audit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  const contentType = request.headers.get('content-type') ?? '';

  if (
    contentLength <= 0 ||
    contentLength > 16 * 1024 ||
    !(
      contentType.includes('application/json') ||
      contentType.includes('application/csp-report')
    )
  ) {
    return new NextResponse(null, { status: 413 });
  }

  // Browsers may omit Origin on CSP reports, so only reject when an explicit
  // untrusted origin is present (blocks cross-origin spam without dropping
  // legitimate same-origin reports).
  const origin = request.headers.get('origin');
  if (origin && !isTrustedRequestOrigin(request.headers)) {
    return new NextResponse(null, { status: 204 });
  }

  const ip = requestIp(request.headers) ?? 'unknown';
  const limit = await consumeRateLimit(
    `csp-report:${ip}`,
    60,
    60 * 1000,
  ).catch(() => ({ allowed: false }));

  if (!limit.allowed) {
    return new NextResponse(null, { status: 204 });
  }

  const report = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const body =
    (report['csp-report'] as Record<string, unknown> | undefined) ?? report;

  await auditService
    .record({
      action: 'security.csp_violation',
      ip,
      metadata: {
        blockedUri: body['blocked-uri'],
        disposition: body.disposition,
        effectiveDirective: body['effective-directive'],
        sourceFile: body['source-file'],
      },
      requestId: requestId(request),
      result: 'failed',
      targetType: 'content_security_policy',
    })
    .catch(() => undefined);

  return new NextResponse(null, { status: 204 });
}
