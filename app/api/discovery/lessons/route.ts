import { z } from 'zod';
import { requireStaffSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  listDiscoveryLessons,
  scheduleDiscoveryLesson,
} from '@/lib/server/services/discovery';

const inputSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  candidateId: z.string().uuid(),
  createAccount: z
    .object({ username: z.string().trim().min(3).max(40) })
    .nullable()
    .optional(),
  durationMinutes: z.number().int().min(15).max(180).optional(),
  instructorProfileId: z.string().uuid(),
  locale: z.enum(['tr', 'en']).default('tr'),
  note: z.string().max(500).nullable().optional(),
  scheduledAt: z.string().datetime(),
});

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const principal = await requireStaffSession();
    const lessons = await listDiscoveryLessons(principal);
    return apiResponse({ lessons }, 200, id);
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

    const principal = await requireStaffSession();
    const result = await scheduleDiscoveryLesson(principal, parsed.data);
    return apiResponse({ lesson: result }, 201, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
