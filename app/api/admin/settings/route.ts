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
import { getAllSettings, updateSettings } from '@/lib/server/services/settings';

const patchSchema = z
  .object({
    installmentReminderDays: z.number().int().min(0).max(30).optional(),
    joinLeadMinutes: z.number().int().min(0).max(120).optional(),
    lessonAutoCloseHours: z.number().int().min(1).max(48).optional(),
    mailMode: z.enum(['live', 'test']).optional(),
    paymentReviewStaleDays: z.number().int().min(1).max(30).optional(),
  })
  .refine(
    (value) =>
      value.installmentReminderDays !== undefined ||
      value.joinLeadMinutes !== undefined ||
      value.lessonAutoCloseHours !== undefined ||
      value.mailMode !== undefined ||
      value.paymentReviewStaleDays !== undefined,
    { message: 'no_fields' },
  );

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);

  try {
    await requireAdminSession();
    const settings = await getAllSettings();
    return apiResponse({ settings }, 200, id);
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
    const parsed = patchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    const settings = await updateSettings(parsed.data, principal.id);

    await auditService.record({
      action: 'admin.settings_updated',
      actorUserId: principal.id,
      ip: requestIp(request.headers),
      metadata: parsed.data,
      requestId: id,
      result: 'success',
      targetType: 'workspace',
    });

    return apiResponse({ settings }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
