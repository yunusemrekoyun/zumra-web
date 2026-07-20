import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { decideLessonChangeRequest } from '@/lib/server/services/lesson-change-requests';

const inputSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional(),
  startsAt: z.string().datetime().optional(),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { requestId: changeRequestId } = await params;
    if (!z.string().uuid().safeParse(changeRequestId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const result = await decideLessonChangeRequest(
      principal,
      changeRequestId,
      parsed.data,
    );

    return apiResponse({ request: result }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
