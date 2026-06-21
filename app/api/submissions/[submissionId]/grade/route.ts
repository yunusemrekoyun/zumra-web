import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { gradeSubmission } from '@/lib/server/services/assignments';

const gradeSchema = z.object({
  score: z.number().int().min(0).max(100000),
  feedback: z.string().max(5000).optional(),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { submissionId } = await params;
    if (!z.string().uuid().safeParse(submissionId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const parsed = gradeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    await gradeSubmission(principal, { submissionId, ...parsed.data });
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
