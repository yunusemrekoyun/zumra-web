import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { markStaffConversationRead } from '@/lib/server/services/staff-chat';

export const runtime = 'nodejs';

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
    const result = await markStaffConversationRead(principal, conversationId);
    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
