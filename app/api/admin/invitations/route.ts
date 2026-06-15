import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCriticalAdmin } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { auditService } from '@/lib/server/services/audit';
import { invitationService } from '@/lib/server/services/invitations';

const inputSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['tr', 'en']).default('tr'),
  name: z.string().min(2).max(100),
  password: z.string().min(12).max(128),
  role: z.enum(['advisor', 'student']),
  username: z.string().min(5).max(30),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const principal = await requireCriticalAdmin(parsed.data.password);
    const invitation = await invitationService.create(
      principal,
      {
        email: parsed.data.email,
        locale: parsed.data.locale,
        name: parsed.data.name,
        role: parsed.data.role,
        username: parsed.data.username,
      },
    );
    await auditService.record({
      action: 'invitation.create',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: invitation.id,
      targetType: 'user_invitation',
    });

    return apiResponse(invitation, 201, id);
  } catch (error) {
    await auditService.record({
      action: 'invitation.create',
      ip: requestIp(request.headers),
      requestId: id,
      result: 'failed',
      targetType: 'user_invitation',
    }).catch(() => undefined);
    return apiErrorResponse(error, id);
  }
}
