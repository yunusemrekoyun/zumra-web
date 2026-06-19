import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PublicFlowError } from '@/lib/server/http/errors';
import { consumeRateLimit } from '@/lib/server/redis/rate-limit';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { invitationService } from '@/lib/server/services/invitations';

const inputSchema = z.object({
  password: z.string().min(12).max(128),
  token: z.string().min(32).max(256),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isTrustedRequestOrigin(request.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const ip = requestIp(request.headers) ?? 'unknown';
  const limit = await consumeRateLimit(
    `activation:${ip}`,
    10,
    15 * 60 * 1000,
  );

  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.some(
      (issue) => issue.path[0] === 'password',
    );
    return NextResponse.json(
      { error: passwordIssue ? 'invalid_password' : 'invalid_request' },
      { status: 400 },
    );
  }

  try {
    await invitationService.activate(parsed.data.token, parsed.data.password);
    return NextResponse.json({ activated: true });
  } catch (error) {
    if (error instanceof PublicFlowError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'invalid_or_expired_invitation' },
      { status: 400 },
    );
  }
}
