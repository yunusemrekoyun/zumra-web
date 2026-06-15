import { z } from 'zod';
import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import {
  isTrustedRequestOrigin,
  requestIp,
} from '@/lib/server/security/network';
import { auditService } from '@/lib/server/services/audit';
import { attachInstructorDocument } from '@/lib/server/services/instructors';

const inputSchema = z.object({
  kind: z.enum(['certificate', 'identity', 'contract', 'other']),
  label: z.string().trim().min(2).max(180),
  mediaAssetId: z.string().uuid(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

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
    const document = await attachInstructorDocument(
      principal,
      instructorId,
      parsed.data,
    );
    await auditService.record({
      action: 'instructor.document_attached',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: document?.id,
      targetType: 'instructor_document',
    });
    return apiResponse(document ?? {}, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
