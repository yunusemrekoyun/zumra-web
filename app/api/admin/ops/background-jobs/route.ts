import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  getBackgroundJobStatus,
  retryFailedNotifications,
} from '@/lib/server/services/background-jobs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    const principal = await requireSession();
    const status = await getBackgroundJobStatus(principal);
    return apiResponse({ status }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireSession();
    const result = await retryFailedNotifications(principal);
    const status = await getBackgroundJobStatus(principal);
    return apiResponse({ result, status }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
