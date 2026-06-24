import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import { requireAdminSession } from '@/lib/server/authorization';
import { apiResponse, requestId } from '@/lib/server/http/api-errors';
import { getMediaForDownload } from '@/lib/server/services/storage-admin';

export const runtime = 'nodejs';

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

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', () => archive.abort());

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
    void archive.finalize();

    return new Response(
      Readable.toWeb(archive as unknown as Readable) as ReadableStream,
      {
        headers: {
          'Content-Disposition': 'attachment; filename="zumra-medya.zip"',
          'Content-Type': 'application/zip',
        },
      },
    );
  } catch {
    return apiResponse({ error: 'failed' }, 500, id);
  }
}
