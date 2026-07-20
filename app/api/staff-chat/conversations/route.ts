import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import {
  listStaffContacts,
  listStaffConversations,
  resolveStaffConversation,
} from '@/lib/server/services/staff-chat';

const inputSchema = z.object({
  peerUserId: z.string().min(1).max(64),
});

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const principal = await requireSession();
    const [conversations, contacts] = await Promise.all([
      listStaffConversations(principal),
      listStaffContacts(principal),
    ]);
    return apiResponse({ contacts, conversations }, 200, id);
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

    const principal = await requireSession();
    const conversation = await resolveStaffConversation(
      principal,
      parsed.data.peerUserId,
    );
    return apiResponse({ conversation }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
