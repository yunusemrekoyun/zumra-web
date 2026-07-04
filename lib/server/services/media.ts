import 'server-only';

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type {
  MediaAssetRecord,
  MediaKind,
  MediaService,
  MediaVisibility,
  WorkspacePrincipal,
} from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import { mediaAssets } from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PayloadTooLargeError,
  UnsafeMediaError,
} from '@/lib/server/http/errors';
import { enqueueMediaProcessing } from '@/lib/server/queues/media';
import {
  ensureMediaDirectories,
  outputRelativePath,
  resolveMediaPath,
  sourceRelativePath,
} from '@/lib/server/media/paths';
import { assertUserQuota } from '@/lib/server/media/quota';
import {
  assertUploadCapacity,
  inspectUploadedFile,
  maxBytesForKind,
  scanWithClamAv,
} from '@/lib/server/media/validation';
import { mediaAuthorizationService } from './media-authorization';

export const mediaService: MediaService = {
  async getAuthorizedAsset(principal, mediaId) {
    const [asset] = await database
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, mediaId))
      .limit(1);

    if (
      !asset ||
      !(await mediaAuthorizationService.canRead(principal, asset))
    ) {
      return null;
    }

    return toMediaRecord(asset);
  },

  async queueProcessing(mediaId) {
    await scheduleMediaProcessing(mediaId);
  },
};

export async function receiveMediaUpload(input: {
  body: ReadableStream<Uint8Array>;
  kind: MediaKind;
  originalName: string;
  owner: WorkspacePrincipal;
  visibility: MediaVisibility;
}) {
  await ensureMediaDirectories();
  await assertUploadCapacity();

  if (!(await mediaAuthorizationService.canUpload(input.owner, input.visibility))) {
    throw new AuthorizationDeniedError('Media upload is not authorized.');
  }

  // Fail fast if the user is already at/over their quota before streaming.
  await assertUserQuota(input.owner.id, 0);

  const [asset] = await database
    .insert(mediaAssets)
    .values({
      kind: input.kind,
      originalName: input.originalName.slice(0, 255),
      ownerUserId: input.owner.id,
      status: 'uploading',
      visibility: input.visibility,
    })
    .returning({ id: mediaAssets.id });

  if (!asset) {
    throw new Error('Media record could not be created.');
  }

  const relativeSource = sourceRelativePath(asset.id);
  const absoluteSource = resolveMediaPath(relativeSource);
  let processingQueued = false;
  let publishedOutputPath: string | undefined;
  const hash = createHash('sha256');
  let bytes = 0;
  const maxBytes = maxBytesForKind(input.kind);
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;

      if (bytes > maxBytes) {
        callback(new PayloadTooLargeError());
        return;
      }

      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.from(input.body as unknown as AsyncIterable<Uint8Array>),
      limiter,
      createWriteStream(absoluteSource, { flags: 'wx', mode: 0o660 }),
    );

    const inspected = await inspectUploadedFile(absoluteSource, input.kind);
    await assertUserQuota(input.owner.id, inspected.sizeBytes);
    await database
      .update(mediaAssets)
      .set({
        checksumSha256: hash.digest('hex'),
        mimeType: inspected.mimeType,
        sizeBytes: inspected.sizeBytes,
        sourcePath: relativeSource,
        status: 'uploaded',
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, asset.id));

    await database
      .update(mediaAssets)
      .set({ status: 'scanning', updatedAt: new Date() })
      .where(eq(mediaAssets.id, asset.id));
    await scanWithClamAv(absoluteSource);

    if (input.kind === 'video' || input.kind === 'image') {
      const [processing] = await database
        .update(mediaAssets)
        .set({
          processingAttempts: 0,
          processingGeneration: sql`${mediaAssets.processingGeneration} + 1`,
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(mediaAssets.id, asset.id))
        .returning({ generation: mediaAssets.processingGeneration });

      if (!processing) {
        throw new Error('Media processing generation could not be created.');
      }

      processingQueued = true;
      await enqueueMediaProcessing(asset.id, processing.generation);
    } else {
      const outputPath = outputRelativePath(
        asset.id,
        inspected.extension,
        input.visibility,
      );
      publishedOutputPath = resolveMediaPath(outputPath);
      await rename(absoluteSource, publishedOutputPath);
      await database
        .update(mediaAssets)
        .set({
          outputPath,
          sourcePath: null,
          status: 'ready',
          updatedAt: new Date(),
        })
        .where(eq(mediaAssets.id, asset.id));
    }

    return { id: asset.id };
  } catch (error) {
    const quarantined = error instanceof UnsafeMediaError;

    if (!quarantined && !processingQueued) {
      await Promise.all([
        unlink(absoluteSource).catch(() => undefined),
        publishedOutputPath
          ? unlink(publishedOutputPath).catch(() => undefined)
          : Promise.resolve(),
      ]);
    }

    await database
      .update(mediaAssets)
      .set({
        errorCode: quarantined
          ? 'malware_detected'
          : processingQueued
            ? 'queue_unavailable'
            : 'upload_processing_failed',
        quarantineDeleteAfter: quarantined
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
        sourcePath:
          quarantined || processingQueued ? relativeSource : null,
        status: quarantined
          ? 'quarantined'
          : processingQueued
            ? 'processing'
            : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, asset.id));

    if (processingQueued) {
      return { id: asset.id };
    }

    throw error;
  }
}

// Lightweight status probe for the client to poll after upload — image/video
// assets are 'processing' until the media worker finishes, and the attach
// endpoints require 'ready'. Only the owner (or admin) may read it.
export async function getOwnedAssetStatus(
  mediaId: string,
  principal: WorkspacePrincipal,
): Promise<{ status: string } | null> {
  const [asset] = await database
    .select({ status: mediaAssets.status, ownerUserId: mediaAssets.ownerUserId })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
    .limit(1);
  if (!asset) return null;
  if (asset.ownerUserId !== principal.id && principal.role !== 'admin') {
    return null;
  }
  return { status: asset.status };
}

export async function getReadyAsset(
  mediaId: string,
  principal: WorkspacePrincipal | null,
) {
  const conditions = [
    eq(mediaAssets.id, mediaId),
    eq(mediaAssets.status, 'ready'),
  ];
  const [asset] = await database
    .select()
    .from(mediaAssets)
    .where(and(...conditions))
    .limit(1);

  if (
    !asset ||
    !asset.outputPath ||
    !(await mediaAuthorizationService.canRead(principal, asset))
  ) {
    return null;
  }

  return asset;
}

async function scheduleMediaProcessing(mediaId: string) {
  const [asset] = await database
    .update(mediaAssets)
    .set({
      leaseExpiresAt: null,
      lockedAt: null,
      lockedBy: null,
      processingGeneration: sql`${mediaAssets.processingGeneration} + 1`,
      status: 'processing',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.id, mediaId),
        inArray(mediaAssets.status, ['failed', 'processing']),
        eq(mediaAssets.kind, 'video'),
        isNotNull(mediaAssets.sourcePath),
      ),
    )
    .returning({ generation: mediaAssets.processingGeneration });

  if (!asset) {
    throw new Error('Media record could not be scheduled.');
  }

  await enqueueMediaProcessing(mediaId, asset.generation);
}

function toMediaRecord(
  asset: typeof mediaAssets.$inferSelect,
): MediaAssetRecord {
  return {
    id: asset.id,
    kind: asset.kind,
    mimeType: asset.mimeType ?? undefined,
    originalName: asset.originalName,
    ownerUserId: asset.ownerUserId,
    sizeBytes: asset.sizeBytes ?? undefined,
    status: asset.status,
    visibility: asset.visibility,
  };
}
