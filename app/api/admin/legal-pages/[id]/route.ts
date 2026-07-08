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
import {
  deleteLegalPage,
  LegalPageError,
  updateLegalPage,
} from '@/lib/server/services/legal-pages';

const updateSchema = z
  .object({
    slug: z.string().trim().max(80).optional(),
    titleTr: z.string().trim().min(1).max(160).optional(),
    titleEn: z.string().trim().max(160).optional(),
    bodyTr: z.string().max(200_000).optional(),
    bodyEn: z.string().max(200_000).optional(),
    published: z.boolean().optional(),
    showInFooter: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'no_fields' });

export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestIdValue = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, requestIdValue);
  }

  try {
    const principal = await requireAdminSession();
    const { id } = await params;
    const parsed = updateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, requestIdValue);
    }

    const page = await updateLegalPage(id, parsed.data, principal.id);

    await auditService.record({
      action: 'admin.legal_page_updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: { slug: page.slug, published: page.published },
      requestId: requestIdValue,
      result: 'success',
      targetType: 'legal_page',
      targetId: page.id,
    });

    return apiResponse({ page }, 200, requestIdValue);
  } catch (error) {
    if (error instanceof LegalPageError) {
      const status = error.code === 'not_found' ? 404 : 400;
      return apiResponse({ error: error.code }, status, requestIdValue);
    }
    return apiErrorResponse(error, requestIdValue);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestIdValue = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, requestIdValue);
  }

  try {
    const principal = await requireAdminSession();
    const { id } = await params;
    await deleteLegalPage(id);

    await auditService.record({
      action: 'admin.legal_page_deleted',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: { legalPageId: id },
      requestId: requestIdValue,
      result: 'success',
      targetType: 'legal_page',
      targetId: id,
    });

    return apiResponse({ ok: true }, 200, requestIdValue);
  } catch (error) {
    return apiErrorResponse(error, requestIdValue);
  }
}
