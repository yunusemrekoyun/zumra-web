import { z } from 'zod';
import { isValidTurkishIban } from '@/lib/domain/iban';
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
  listInstructorBankAccounts,
  setInstructorBankAccount,
} from '@/lib/server/services/payments';

const accountSchema = z.object({
  holderName: z.string().max(120).optional(),
  iban: z.string().refine(isValidTurkishIban, { message: 'invalid_iban' }),
  instructorId: z.string().uuid(),
});

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    const principal = await requireAdminSession();
    const instructorId = new URL(request.url).searchParams.get('instructorId');

    if (!instructorId || !z.string().uuid().safeParse(instructorId).success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const accounts = await listInstructorBankAccounts(principal, instructorId);
    return apiResponse({ accounts }, 200, id);
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
    const parsed = accountSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const result = await setInstructorBankAccount(principal, parsed.data);
    await auditService.record({
      action: 'instructor_bank_account.updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      requestId: id,
      result: 'success',
      targetId: parsed.data.instructorId,
      targetType: 'instructor_profile',
    });
    return apiResponse(result, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
