import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  getStudentPrincipalOrNotFound,
  isNotFoundResponse,
} from '@/lib/server/http/student-google';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { auditService } from '@/lib/server/services/audit';
import { googleIdentityService } from '@/lib/server/services/google-identities';

const inputSchema = z.object({
  locale: z.enum(['tr', 'en']),
  password: z.string().min(12).max(128),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const principal = await getStudentPrincipalOrNotFound();

  if (isNotFoundResponse(principal)) {
    return principal;
  }

  try {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    await auditService.record({
      action: 'google_identity.link_started',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: principal.id,
      targetType: 'external_identity',
    });
    const result = await googleIdentityService.beginLink(
      principal,
      parsed.data.password,
      parsed.data.locale,
      request.headers,
    );

    const response = apiResponse({ url: result.url }, 200, id);

    for (const cookie of result.setCookies) {
      response.headers.append('set-cookie', cookie);
    }

    return response;
  } catch (error) {
    await auditService
      .record({
        action: 'google_identity.link_failed',
        actorUserId: principal.id,
        ip: requestIp(request.headers),
        requestId: id,
        result: 'failed',
        targetId: principal.id,
        targetType: 'external_identity',
      })
      .catch(() => undefined);
    return apiErrorResponse(error, id);
  }
}
