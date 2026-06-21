import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { shareAssignmentInChat } from '@/lib/server/services/conversations';

const shareSchema = z.object({ studentProfileId: z.string().uuid() });

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
    const parsed = shareSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    await shareAssignmentInChat(
      principal,
      assignmentId,
      parsed.data.studentProfileId,
    );
    return apiResponse({ ok: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
