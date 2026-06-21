import { z } from 'zod';
import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { maxBytesForKind } from '@/lib/server/media/validation';
import { isTrustedRequestOrigin } from '@/lib/server/security/network';
import { receiveMediaUpload } from '@/lib/server/services/media';

const kindSchema = z.enum(['image', 'video', 'document', 'audio']);
const visibilitySchema = z.enum(['private', 'public']).default('private');

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const id = requestId(request);

  if (!isTrustedRequestOrigin(request.headers)) {
    return apiResponse({ error: 'forbidden' }, 403, id);
  }

  try {
    const owner = await requireSession();
    const body = request.body;
    const kind = kindSchema.safeParse(request.headers.get('x-media-kind'));
    const visibility = visibilitySchema.safeParse(
      request.headers.get('x-media-visibility') ?? 'private',
    );
    const originalName = request.headers.get('x-file-name')?.trim();
    const contentLength = Number(request.headers.get('content-length') ?? 0);

    if (
      !body ||
      !kind.success ||
      !visibility.success ||
      !originalName ||
      originalName.length > 255
    ) {
      return apiResponse({ error: 'invalid_request' }, 400, id);
    }

    if (contentLength <= 0 || contentLength > maxBytesForKind(kind.data)) {
      return apiResponse({ error: 'invalid_size' }, 413, id);
    }

    const media = await receiveMediaUpload({
      body,
      kind: kind.data,
      originalName,
      owner,
      visibility: visibility.data,
    });
    return apiResponse(media, 202, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
