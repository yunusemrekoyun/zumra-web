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
  createLegalPage,
  LegalPageError,
  listAdminLegalPages,
} from '@/lib/server/services/legal-pages';

const createSchema = z.object({
  slug: z.string().trim().max(80).optional(),
  titleTr: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().max(160).optional(),
  bodyTr: z.string().max(200_000).optional(),
  bodyEn: z.string().max(200_000).optional(),
  published: z.boolean().optional(),
  showInFooter: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    await requireAdminSession();
    const pages = await listAdminLegalPages();
    return apiResponse({ pages }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = createSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const page = await createLegalPage(parsed.data, principal.id);

    await auditService.record({
      action: 'admin.legal_page_created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: { slug: page.slug, titleTr: page.titleTr },
      requestId: id,
      result: 'success',
      targetType: 'legal_page',
      targetId: page.id,
    });

    return apiResponse({ page }, 201, id);
  } catch (error) {
    if (error instanceof LegalPageError) {
      return apiResponse({ error: error.code }, 400, id);
    }
    return apiErrorResponse(error, id);
  }
}
