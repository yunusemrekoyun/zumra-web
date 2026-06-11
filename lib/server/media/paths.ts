import 'server-only';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getRuntimeEnv } from '@/lib/server/env';

export function mediaRoot() {
  return path.resolve(getRuntimeEnv().MEDIA_ROOT);
}

export function resolveMediaPath(relativePath: string) {
  const root = mediaRoot();
  const resolved = path.resolve(root, relativePath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Media path escaped its storage root.');
  }

  return resolved;
}

export function canonicalMediaRelativePath(relativePath: string) {
  const root = mediaRoot();
  const resolved = resolveMediaPath(relativePath);
  const canonical = path.relative(root, resolved).split(path.sep).join('/');

  if (
    !canonical ||
    canonical === '.' ||
    canonical.startsWith('../') ||
    canonical !== relativePath
  ) {
    throw new Error('Media path is not canonical.');
  }

  return canonical;
}

export async function ensureMediaDirectories() {
  await Promise.all(
    [
      'quarantine',
      'processing',
      'ready/private',
      'ready/public',
      'thumbnails/private',
      'thumbnails/public',
      'tmp',
    ].map((directory) =>
      mkdir(resolveMediaPath(directory), { recursive: true }),
    ),
  );
}

export function sourceRelativePath(mediaId: string) {
  return `quarantine/${mediaId}.source`;
}

export function outputRelativePath(
  mediaId: string,
  extension: string,
  visibility: 'private' | 'public',
) {
  return `ready/${visibility}/${mediaId}.${extension}`;
}

export function thumbnailRelativePath(
  mediaId: string,
  visibility: 'private' | 'public',
) {
  return `thumbnails/${visibility}/${mediaId}.jpg`;
}
