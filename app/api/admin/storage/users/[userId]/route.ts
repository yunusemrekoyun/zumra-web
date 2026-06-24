import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { getUserStorageDetail } from '@/lib/server/services/storage-admin';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const id = requestId(request);
  const { userId } = await params;

  try {
    const principal = await requireAdminSession();
    const detail = await getUserStorageDetail(principal, userId);
    return apiResponse(detail, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
