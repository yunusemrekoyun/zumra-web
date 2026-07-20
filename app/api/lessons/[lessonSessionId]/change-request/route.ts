import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { createLessonChangeRequest } from '@/lib/server/services/lesson-change-requests';

const inputSchema = z.object({
  note: z.string().max(1000).optional(),
  requestedStartsAt: z.string().datetime().optional(),
  type: z.enum(['cancel', 'postpone']),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonSessionId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { lessonSessionId } = await params;
    if (!z.string().uuid().safeParse(lessonSessionId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const result = await createLessonChangeRequest(
      principal,
      lessonSessionId,
      parsed.data,
    );

    return apiResponse({ request: result }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
