import { requireSession } from '@/lib/server/authorization';
import {
  apiErrorResponse,
  apiResponse,
  requestId,
} from '@/lib/server/http/api-errors';
import { getOwnedAssetStatus } from '@/lib/server/services/media';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const id = requestId(request);

  try {
    const principal = await requireSession();
    const { mediaId } = await params;
    const asset = await getOwnedAssetStatus(mediaId, principal);
    if (!asset) {
      return apiResponse({ error: 'not_found' }, 404, id);
    }
    return apiResponse({ status: asset.status }, 200, id);
  } catch (error) {
    return apiErrorResponse(error, id);
  }
}
