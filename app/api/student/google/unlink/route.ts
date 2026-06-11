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

    await googleIdentityService.unlink(
      principal,
      parsed.data.password,
      request.headers,
    );
    await auditService.record({
      action: 'google_identity.unlinked',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: principal.id,
      targetType: 'external_identity',
    });

    return apiResponse({ status: 'unlinked' }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
