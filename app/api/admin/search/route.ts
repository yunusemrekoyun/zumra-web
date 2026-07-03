import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { searchAdminDirectory } from '@/lib/server/services/admin-search';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    await requireAdminSession();
    const q =
      new URL(request.url).searchParams.get('q')?.trim().slice(0, 100) ?? '';
    const results = await searchAdminDirectory(q);
    return apiResponse({ results }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
