import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  getMessagesSince,
  sendMessage,
} from '@/lib/server/services/conversations';

const sendSchema = z.object({
  body: z.string().max(5000).optional(),
  attachmentMediaIds: z.array(z.string().uuid()).max(10).optional(),
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
    const since = new URL(request.url).searchParams.get('since');
    if (!since) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const messages = await getMessagesSince(principal, conversationId, since);
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

    const principal = await requireSession();
    const parsed = sendSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await sendMessage(principal, {
      conversationId,
      ...parsed.data,
    });
    return apiResponse(result, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
