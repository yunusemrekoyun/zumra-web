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
  archiveProgramBranch,
  getProgramBranchArchivePreview,
} from '@/lib/server/services/programs';

const archiveSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  transfers: z
    .array(
      z.object({
        capacityOverride: z.boolean().optional(),
        capacityOverrideNote: z
          .string()
          .trim()
          .max(500)
          .optional()
          .or(z.literal('')),
        enrollmentId: z.string().uuid(),
        targetBranchId: z.string().uuid(),
      }),
    )
    .max(10_000),
});

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const id = requestId(request);

  try {
    const principal = await requireAdminSession();
    const { branchId } = await params;
    if (!z.string().uuid().safeParse(branchId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }
    const preview = await getProgramBranchArchivePreview(
      principal,
      branchId,
    );
    return apiResponse({ preview }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branchId: string }> },
) {
  const id = requestId(request);
  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const { branchId } = await params;
    const parsed = archiveSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (
      !z.string().uuid().safeParse(branchId).success ||
      !parsed.success
    ) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await archiveProgramBranch(
      principal,
      branchId,
      parsed.data,
    );
    await auditService.record({
      action: 'program_branch.archived',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: {
        transferredEnrollmentCount: result.transferred,
      },
      requestId: id,
      result: 'success',
      targetId: branchId,
      targetType: 'program_branch',
    });
    return apiResponse(result, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
