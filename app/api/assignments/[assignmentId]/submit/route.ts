import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { submitAssignment } from '@/lib/server/services/assignments';

const submitSchema = z.object({
  body: z.string().max(5000).optional(),
  attachmentMediaIds: z.array(z.string().uuid()).max(20).optional(),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { assignmentId } = await params;
    if (!z.string().uuid().safeParse(assignmentId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const parsed = submitSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    await submitAssignment(principal, { assignmentId, ...parsed.data });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
