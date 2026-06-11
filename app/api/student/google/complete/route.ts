import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/server/auth';
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
  mode: z.enum(['link', 'signin']),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const principal = await getStudentPrincipalOrNotFound({
    allowPending: true,
  });

  if (isNotFoundResponse(principal)) {
    return principal;
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const identity = await googleIdentityService.syncLinkedIdentity(
      principal.id,
      request.headers,
      parsed.data.mode,
    );
    await auditService.record({
      action:
        parsed.data.mode === 'link'
          ? 'google_identity.linked'
          : 'google_identity.signed_in',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: principal.id,
      targetType: 'external_identity',
    });

    return apiResponse({ identity, status: 'ready' }, 200, id);
  } catch (error) {
    if (parsed.data.mode === 'signin') {
      await auth.api.signOut({ headers: request.headers }).catch(() => undefined);
    }

    await auditService
      .record({
        action:
          parsed.data.mode === 'link'
            ? 'google_identity.link_failed'
            : 'google_identity.sign_in_failed',
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
