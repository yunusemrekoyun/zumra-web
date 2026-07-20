import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { reportDiscoveryPayment } from '@/lib/server/services/discovery';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { lessonId } = await params;
    if (!z.string().uuid().safeParse(lessonId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const result = await reportDiscoveryPayment(principal, lessonId);
    return apiResponse({ lesson: result }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
