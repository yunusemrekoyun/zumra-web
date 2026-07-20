import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { saveTeacherEvaluation } from '@/lib/server/services/student-progress';

const inputSchema = z.object({
  note: z.string().max(2000),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studentProfileId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const { studentProfileId } = await params;
    if (!z.string().uuid().safeParse(studentProfileId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireSession();
    const result = await saveTeacherEvaluation(
      principal,
      studentProfileId,
      parsed.data.note,
    );

    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
