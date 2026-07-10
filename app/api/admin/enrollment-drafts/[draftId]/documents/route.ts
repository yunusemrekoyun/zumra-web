import { z } from 'zod';
import { requireStaffSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  attachEnrollmentDocument,
  removeEnrollmentDocument,
} from '@/lib/server/services/enrollments';

const documentSchema = z.object({
  label: z.string().trim().min(2).max(180),
  mediaAssetId: z.string().uuid(),
  type: z.enum(['identity', 'passport', 'receipt', 'contract', 'other']),
});

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const parsed = documentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireStaffSession();
    const { draftId } = await params;
    const document = await attachEnrollmentDocument(
      principal,
      draftId,
      parsed.data,
    );
    return apiResponse(document, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const documentId = new URL(request.url).searchParams.get('documentId');
    if (!documentId) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireStaffSession();
    const { draftId } = await params;
    await removeEnrollmentDocument(principal, draftId, documentId);
    return apiResponse({ removed: true }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
