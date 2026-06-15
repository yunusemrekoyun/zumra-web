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
  createProgramBranch,
  updateProgramBranch,
} from '@/lib/server/services/programs';

const branchSchema = z.object({
  instructorProfileId: z.string().uuid().optional().or(z.literal('')),
  maximumCapacity: z.number().int().min(1).max(10_000),
  minimumCapacity: z.number().int().min(1).max(10_000),
  name: z.string().trim().min(2).max(180),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  plannedEndDate: z.string().date(),
  plannedStartDate: z.string().date(),
  programId: z.string().uuid(),
  status: z
    .enum([
      'draft',
      'enrollment_open',
      'enrollment_closed',
      'in_progress',
      'completed',
      'cancelled',
    ])
    .default('enrollment_open'),
  timezone: z.string().trim().min(1).max(80).optional(),
});

const updateSchema = branchSchema.extend({
  id: z.string().uuid(),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = branchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const branch = await createProgramBranch(principal, parsed.data);
    await auditService.record({
      action: 'program_branch.created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: branch?.id,
      targetType: 'program_branch',
    });
    return apiResponse(branch ?? {}, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}

export async function PATCH(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const principal = await requireAdminSession();
    const parsed = updateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const { id: branchId, ...input } = parsed.data;
    const branch = await updateProgramBranch(principal, branchId, input);
    await auditService.record({
      action: 'program_branch.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: branchId,
      targetType: 'program_branch',
    });
    return apiResponse(branch, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
