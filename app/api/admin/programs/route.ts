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
  createProgram,
  programMarketingIcons,
  supportedProgramLanguages,
  supportedProgramLevels,
  updateProgram,
} from '@/lib/server/services/programs';

const programSchema = z.object({
  active: z.boolean(),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  displayOrder: z.number().int().min(0).max(999).optional(),
  language: z.enum(supportedProgramLanguages),
  levels: z.array(z.enum(supportedProgramLevels)).min(1).max(6),
  listPriceCents: z.number().int().nonnegative(),
  marketingIcon: z.enum(programMarketingIcons).optional(),
  name: z.string().trim().min(2).max(180),
  popular: z.boolean().optional(),
  publicVisible: z.boolean().optional(),
});

const updateSchema = programSchema.extend({
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
    const parsed = programSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const program = await createProgram(principal, parsed.data);
    await auditService.record({
      action: 'program.created',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: program?.id,
      targetType: 'program',
    });
    return apiResponse(program ?? {}, 201, id);
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

    const { id: programId, ...input } = parsed.data;
    const program = await updateProgram(principal, programId, input);
    await auditService.record({
      action: 'program.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: programId,
      targetType: 'program',
    });
    return apiResponse(program, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
