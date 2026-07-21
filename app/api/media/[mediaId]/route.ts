import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { getSessionPrincipal } from '@/lib/server/authorization';
import {
  canonicalMediaRelativePath,
  resolveMediaPath,
} from '@/lib/server/media/paths';
import { parseByteRange } from '@/lib/server/media/range';
import { getReadyAsset } from '@/lib/server/services/media';

type MediaRouteProps = {
  params: Promise<{ mediaId: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: MediaRouteProps) {
  const { mediaId } = await params;

  // Non-UUID ids can never match an asset and would make postgres throw on
  // the uuid cast (unhandled 500), so reject them upfront.
  if (!UUID_PATTERN.test(mediaId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const principal = await getSessionPrincipal();
  const asset = await getReadyAsset(mediaId, principal);

  if (!asset?.outputPath) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let outputPath: string;

  try {
    outputPath = canonicalMediaRelativePath(asset.outputPath);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Documents download by default; `?view=1` serves them inline so our own
  // in-app preview modal can render them in an iframe (CSP sandbox still applies).
  const wantInline =
    new URL(request.url).searchParams.get('view') === '1';
  const disposition =
    asset.kind === 'document' && !wantInline ? 'attachment' : 'inline';
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control':
      asset.visibility === 'public'
        ? 'public, max-age=3600, stale-while-revalidate=86400'
        : 'private, no-store',
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
    'Content-Type': asset.mimeType ?? 'application/octet-stream',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  });

  if (asset.kind === 'document') {
    headers.set('Content-Security-Policy', 'sandbox');
  }

  if (process.env.NODE_ENV === 'production') {
    headers.set('X-Accel-Redirect', `/protected-media/${outputPath}`);
    return new NextResponse(null, { headers });
  }

  const filePath = resolveMediaPath(outputPath);
  const fileStat = await stat(filePath).catch(() => null);

  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const range = parseByteRange(request.headers.get('range'), fileStat.size);

  if (range && 'invalid' in range) {
    headers.set('Content-Range', `bytes */${fileStat.size}`);
    return new NextResponse(null, { headers, status: 416 });
  }

  if (range) {
    headers.set(
      'Content-Range',
      `bytes ${range.start}-${range.end}/${fileStat.size}`,
    );
    headers.set('Content-Length', String(range.end - range.start + 1));
    const stream = createReadStream(filePath, range);
    return new NextResponse(Readable.toWeb(stream) as BodyInit, {
      headers,
      status: 206,
    });
  }

  headers.set('Content-Length', String(fileStat.size));
  return new NextResponse(
    Readable.toWeb(createReadStream(filePath)) as BodyInit,
    { headers },
  );
}
