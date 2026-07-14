import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import { requireAdminSession } from '@/lib/server/authorization';
import { apiResponse, requestId } from '@/lib/server/http/api-errors';
import { getMediaForDownload } from '@/lib/server/services/storage-admin';

export const runtime = 'nodejs';

function logZipFailure(id: string, error: unknown) {
  console.error(
    JSON.stringify({
      event: 'storage.zip_download_failed',
      message: error instanceof Error ? error.message : 'unknown',
      requestId: id,
      timestamp: new Date().toISOString(),
    }),
  );
}

export async function GET(request: Request) {
  const id = requestId(request);
  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  try {
    const principal = await requireAdminSession();
    const files = await getMediaForDownload(principal, ids);
    if (!files.length) {
      return apiResponse({ error: 'not_found' }, 404, id);
    }

    // Verify every file is readable before any ZIP bytes are streamed, so a
    // missing file yields a proper 500 instead of a corrupt 200 archive.
    await Promise.all(files.map((file) => access(file.path)));

    const archive = new ZipArchive({ zlib: { level: 6 } });
    // Once headers are sent a clean error response is impossible; log the
    // failure and destroy the stream so the client download visibly fails
    // instead of ending as a silently truncated "successful" ZIP.
    let failed = false;
    archive.on('error', (error) => {
      if (failed) return;
      failed = true;
      logZipFailure(id, error);
      archive.destroy(error);
    });

    const used = new Map<string, number>();
    for (const file of files) {
      const seen = used.get(file.name) ?? 0;
      used.set(file.name, seen + 1);
      let name = file.name;
      if (seen > 0) {
        const dot = name.lastIndexOf('.');
        name =
          dot > 0
            ? `${name.slice(0, dot)} (${seen})${name.slice(dot)}`
            : `${name} (${seen})`;
      }
      archive.append(createReadStream(file.path), { name });
    }
    // Don't await: finalize only settles once the stream is consumed by the
    // response below. Catch the rejection so it can't become unhandled.
    archive.finalize().catch((error: unknown) => {
      if (failed) return;
      failed = true;
      logZipFailure(id, error);
      archive.destroy(
        error instanceof Error ? error : new Error('zip_finalize_failed'),
      );
    });

    return new Response(
      Readable.toWeb(archive as unknown as Readable) as ReadableStream,
      {
        headers: {
          'Content-Disposition': 'attachment; filename="zumra-medya.zip"',
          'Content-Type': 'application/zip',
        },
      },
    );
  } catch (error) {
    logZipFailure(id, error);
    return apiResponse({ error: 'failed' }, 500, id);
  }
}
