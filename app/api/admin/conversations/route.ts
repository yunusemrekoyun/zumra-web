import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { listAllConversations } from '@/lib/server/services/admin-conversations';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    await requireAdminSession();
    const q =
      new URL(request.url).searchParams.get('q')?.trim().slice(0, 100) ||
      undefined;
    const { conversations, truncated } = await listAllConversations(q);
    return apiResponse({ conversations, truncated }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
