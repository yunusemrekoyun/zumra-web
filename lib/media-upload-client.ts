// Image/video uploads finish as status 'processing' (a worker transcodes them)
// while document/audio become 'ready' immediately. Attach/photo endpoints
// require 'ready', so callers that upload an image and immediately attach it
// must wait for processing to finish first.

const READY_KINDS_NEED_WAIT = new Set(['image', 'video']);

type MediaKind = 'audio' | 'document' | 'image' | 'video';

/**
 * Upload a file to /api/media and wait until it is attachable. Returns the
 * media asset id. Single shared implementation — screens must not hand-roll
 * their own fetch (the header contract lives here).
 */
export async function uploadMedia(
  file: File,
  kind: MediaKind,
  { visibility = 'private' }: { visibility?: 'private' | 'public' } = {},
): Promise<string> {
  const response = await fetch('/api/media', {
    body: file,
    credentials: 'same-origin',
    headers: {
      'x-file-name': encodeURIComponent(file.name),
      'x-media-kind': kind,
      'x-media-visibility': visibility,
    },
    method: 'POST',
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
  };
  if (!response.ok || !body.id) {
    // Propagate the real server code (unsupported_media_type, payload_too_large,
    // invalid_size, media_quota_exceeded, rate_limited...) so callers can show a
    // specific, friendly message instead of a generic failure.
    throw new Error(
      typeof body.error === 'string' && body.error
        ? body.error
        : 'media_upload_failed',
    );
  }
  await waitForMediaReady(body.id, kind);
  return body.id;
}

export async function waitForMediaReady(
  mediaAssetId: string,
  kind: string,
  { timeoutMs = 30_000, intervalMs = 1_000 }: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<void> {
  if (!READY_KINDS_NEED_WAIT.has(kind)) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`/api/media/${mediaAssetId}/status`, {
      credentials: 'same-origin',
    });
    const body = (await response.json().catch(() => ({}))) as {
      status?: string;
    };
    if (response.ok && body.status === 'ready') return;
    if (
      response.ok &&
      (body.status === 'failed' || body.status === 'quarantined')
    ) {
      throw new Error('media_processing_failed');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('media_not_ready');
}
