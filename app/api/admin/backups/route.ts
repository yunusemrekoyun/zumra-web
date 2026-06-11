import { requireRole } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { backupStatusService } from '@/lib/server/services/backups';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    await requireRole('admin');
    const runs = await backupStatusService.listRecent();
    return apiResponse({ runs }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
