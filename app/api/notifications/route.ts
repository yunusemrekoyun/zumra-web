import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  getUnreadNotificationCount,
  listNotifications,
} from '@/lib/server/services/notification-feed';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    const principal = await requireSession();
    const [items, unread] = await Promise.all([
      listNotifications(principal),
      getUnreadNotificationCount(principal),
    ]);
    return apiResponse({ items, unread }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
