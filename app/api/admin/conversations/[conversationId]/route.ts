import { z } from 'zod';
import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { getConversationTranscript } from '@/lib/server/services/admin-conversations';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const id = requestId(request);

  try {
    await requireAdminSession();

    const { conversationId } = await params;
    if (!z.string().uuid().safeParse(conversationId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    let before: Date | undefined;
    const beforeParam = new URL(request.url).searchParams.get('before');
    if (beforeParam) {
      const parsed = new Date(beforeParam);
      if (Number.isNaN(parsed.getTime())) {
        return apiResponse({ error: 'invalid_request' }, 400, id);
      }
      before = parsed;
    }

    const conversation = await getConversationTranscript(conversationId, before);
    return apiResponse({ conversation }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
