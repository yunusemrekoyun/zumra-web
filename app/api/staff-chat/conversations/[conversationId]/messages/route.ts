import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  getStaffMessages,
  sendStaffMessage,
} from '@/lib/server/services/staff-chat';

const inputSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const id = requestId(request);
  try {
    const { conversationId } = await params;
    if (!z.string().uuid().safeParse(conversationId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const afterId = new URL(request.url).searchParams.get('after') ?? undefined;
    if (afterId && !z.string().uuid().safeParse(afterId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const messages = await getStaffMessages(principal, conversationId, {
      afterId,
    });
    return apiResponse({ messages }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { conversationId } = await params;
    if (!z.string().uuid().safeParse(conversationId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const message = await sendStaffMessage(
      principal,
      conversationId,
      parsed.data.body,
    );
    return apiResponse({ message }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
