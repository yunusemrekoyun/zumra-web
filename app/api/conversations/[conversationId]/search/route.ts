import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { searchMessages } from '@/lib/server/services/conversations';

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
    const query = (new URL(request.url).searchParams.get('q') ?? '').slice(
      0,
      200,
    );

    const principal = await requireSession();
    const messages = await searchMessages(principal, conversationId, query);
    return apiResponse({ messages }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
