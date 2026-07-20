import { z } from 'zod';
import { requireStaffSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { updateDiscoveryLesson } from '@/lib/server/services/discovery';

const inputSchema = z
  .object({
    paymentStatus: z.literal('received').optional(),
    status: z.enum(['completed', 'cancelled', 'no_show']).optional(),
  })
  .refine((value) => value.paymentStatus || value.status, {
    message: 'no_fields',
  });

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

    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireStaffSession();
    const result = await updateDiscoveryLesson(principal, lessonId, parsed.data);
    return apiResponse({ lesson: result }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
