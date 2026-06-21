import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { createAssignment } from '@/lib/server/services/assignments';

const targetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('branch'), branchId: z.string().uuid() }),
  z.object({ type: z.literal('student'), enrollmentId: z.string().uuid() }),
]);

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  requiresSubmission: z.boolean(),
  maxScore: z.number().int().min(1).max(100000).optional(),
  dueAt: z.string().datetime().optional(),
  target: targetSchema,
  lessonSessionId: z.string().uuid().optional(),
  attachmentMediaIds: z.array(z.string().uuid()).max(20).optional(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireSession();
    const parsed = createSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await createAssignment(principal, parsed.data);
    return apiResponse({ id: result.id }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
