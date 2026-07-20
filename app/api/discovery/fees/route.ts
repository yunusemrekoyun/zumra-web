import { z } from 'zod';
import { requireAdminSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  listDiscoveryFees,
  setDiscoveryFee,
} from '@/lib/server/services/discovery';

const inputSchema = z
  .object({
    branchId: z.string().uuid().nullable().optional(),
    feeCents: z.number().int().min(0).max(100_000_000),
    instructorProfileId: z.string().uuid().nullable().optional(),
    scope: z.enum(['branch', 'instructor']),
  })
  .refine(
    (value) =>
      value.scope === 'branch'
        ? Boolean(value.branchId)
        : Boolean(value.instructorProfileId),
    { message: 'target_mismatch' },
  );

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const principal = await requireAdminSession();
    const fees = await listDiscoveryFees(principal);
    return apiResponse({ fees }, 200, id);
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
    const parsed = inputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const principal = await requireAdminSession();
    const result = await setDiscoveryFee(principal, parsed.data);
    return apiResponse({ fee: result }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
