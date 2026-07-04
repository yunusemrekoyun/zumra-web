// Image/video uploads finish as status 'processing' (a worker transcodes them)
// while document/audio become 'ready' immediately. Attach/photo endpoints
// require 'ready', so callers that upload an image and immediately attach it
// must wait for processing to finish first.

const READY_KINDS_NEED_WAIT = new Set(['image', 'video']);

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
