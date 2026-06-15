import { z } from 'zod';
import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { setInstructorPhoto } from '@/lib/server/services/instructors';

const inputSchema = z.object({ mediaAssetId: z.string().uuid() });

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ instructorId: string }> },
) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const { instructorId } = await context.params;
    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!z.string().uuid().safeParse(instructorId).success || !parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }
    const result = await setInstructorPhoto(
      principal,
      instructorId,
      parsed.data.mediaAssetId,
    );
    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
