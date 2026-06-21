import { randomUUID } from 'node:crypto';
import { rename, unlink } from 'node:fs/promises';
import { type Job, Worker } from 'bullmq';
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { tryAcquireAdvisoryLock } from '@/lib/server/db/advisory-lock';
import { database } from '@/lib/server/db/client';
import { mediaAssets } from '@/lib/server/db/schema';
import { getRuntimeEnv } from '@/lib/server/env';
import {
  ensureMediaDirectories,
  outputRelativePath,
  resolveMediaPath,
  thumbnailRelativePath,
} from '@/lib/server/media/paths';
import {
  processImageInSandbox,
  processVideoInSandbox,
} from '@/lib/server/media/sandbox';
import {
  getBullConnection,
  queueNames,
  reportQueueConnectionError,
} from '@/lib/server/queues/config';
import { enqueueMediaProcessing } from '@/lib/server/queues/media';
import { beginJob, endJob } from './activity';

const LEASE_MS = 20 * 60 * 1000;
const RECONCILIATION_INTERVAL_MS = 60 * 1000;

export async function requeuePendingMedia() {
  const pendingAssets = await database
    .select({
      id: mediaAssets.id,
      generation: mediaAssets.processingGeneration,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.status, 'processing'),
        inArray(mediaAssets.kind, ['video', 'image']),
        isNotNull(mediaAssets.sourcePath),
        or(
          isNull(mediaAssets.leaseExpiresAt),
          lte(mediaAssets.leaseExpiresAt, new Date()),
        ),
      ),
    )
    .limit(500);

  for (const asset of pendingAssets) {
    const [claimed] = await database
      .update(mediaAssets)
      .set({
        leaseExpiresAt: null,
        lockedAt: null,
        lockedBy: null,
        processingGeneration: sql`${mediaAssets.processingGeneration} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mediaAssets.id, asset.id),
          eq(mediaAssets.processingGeneration, asset.generation),
          eq(mediaAssets.status, 'processing'),
          or(
            isNull(mediaAssets.leaseExpiresAt),
            lte(mediaAssets.leaseExpiresAt, new Date()),
          ),
        ),
      )
      .returning({ generation: mediaAssets.processingGeneration });

    if (claimed) {
      await enqueueMediaProcessing(asset.id, claimed.generation);
    }
  }
}

export function startMediaReconciliation() {
  const interval = setInterval(() => {
    void requeuePendingMedia().catch((error) => {
      console.error(
        JSON.stringify({
          event: 'media.reconciliation_failed',
          message: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }, RECONCILIATION_INTERVAL_MS);

  return () => clearInterval(interval);
}

export function createMediaWorker(workerId: string) {
  const env = getRuntimeEnv();

  const worker = new Worker(
    queueNames.media,
    (job) => processMediaJob(job, workerId),
    {
      concurrency: env.WORKER_CONCURRENCY,
      connection: getBullConnection(),
      name: workerId,
      prefix: 'zumra',
    },
  );

  worker.on('error', (error) => {
    reportQueueConnectionError('media-worker', error);
  });

  return worker;
}

async function processMediaJob(job: Job, workerId: string) {
  const mediaId = String(job.data.mediaId ?? '');
  const generation = Number(job.data.generation);
  const releaseLock = await tryAcquireAdvisoryLock(`media:${mediaId}`);

  if (!releaseLock) {
    throw new Error('Media processing lock is already held.');
  }

  let active = false;
  let asset: typeof mediaAssets.$inferSelect | undefined;
  let temporaryOutput: string | undefined;
  let temporaryThumbnail: string | undefined;
  let publishedOutput: string | undefined;
  let publishedThumbnail: string | undefined;
  let outputPublished = false;
  let thumbnailPublished = false;

  try {
    const now = new Date();
    [asset] = await database
      .update(mediaAssets)
      .set({
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        lockedAt: now,
        lockedBy: workerId,
        processingAttempts: sql`${mediaAssets.processingAttempts} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(mediaAssets.id, mediaId),
          eq(mediaAssets.processingGeneration, generation),
          eq(mediaAssets.status, 'processing'),
          inArray(mediaAssets.kind, ['video', 'image']),
          isNotNull(mediaAssets.sourcePath),
        ),
      )
      .returning();

    if (!asset) {
      return;
    }

    if (!asset.sourcePath) {
      throw new Error('Media job is not processable.');
    }

    await ensureMediaDirectories();
    const isImage = asset.kind === 'image';
    const attemptId = randomUUID();
    const inputPath = resolveMediaPath(asset.sourcePath);
    const ext = isImage ? 'jpg' : 'mp4';
    const outputPath = outputRelativePath(asset.id, ext, asset.visibility);
    temporaryOutput = resolveMediaPath(
      `tmp/${asset.id}-${generation}-${attemptId}.${ext}`,
    );
    publishedOutput = resolveMediaPath(outputPath);

    let thumbnailPath: string | undefined;
    let processed: { durationSeconds?: number; height: number; width: number };

    beginJob();
    active = true;
    if (isImage) {
      processed = await processImageInSandbox({
        inputPath,
        outputPath: temporaryOutput,
      });
    } else {
      thumbnailPath = thumbnailRelativePath(asset.id, asset.visibility);
      temporaryThumbnail = resolveMediaPath(
        `tmp/${asset.id}-${generation}-${attemptId}.jpg`,
      );
      publishedThumbnail = resolveMediaPath(thumbnailPath);
      processed = await processVideoInSandbox({
        generation,
        inputPath,
        mediaId: asset.id,
        outputPath: temporaryOutput,
        thumbnailPath: temporaryThumbnail,
      });
    }

    const [current] = await database
      .select({ generation: mediaAssets.processingGeneration })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, asset.id))
      .limit(1);

    if (current?.generation !== generation) {
      throw new Error('Stale media processing generation.');
    }

    if (temporaryThumbnail && publishedThumbnail) {
      await rename(temporaryThumbnail, publishedThumbnail);
      thumbnailPublished = true;
      temporaryThumbnail = undefined;
    }
    await rename(temporaryOutput, publishedOutput);
    outputPublished = true;
    temporaryOutput = undefined;
    const updated = await database
      .update(mediaAssets)
      .set({
        errorCode: null,
        height: processed.height,
        leaseExpiresAt: null,
        lockedAt: null,
        lockedBy: null,
        mimeType: isImage ? 'image/jpeg' : 'video/mp4',
        outputPath,
        status: 'ready',
        updatedAt: new Date(),
        width: processed.width,
        ...(isImage
          ? { sourcePath: null }
          : {
              durationSeconds: processed.durationSeconds?.toString() ?? null,
              sourceDeleteAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              thumbnailPath,
            }),
      })
      .where(
        and(
          eq(mediaAssets.id, asset.id),
          eq(mediaAssets.processingGeneration, generation),
          eq(mediaAssets.lockedBy, workerId),
        ),
      )
      .returning({ id: mediaAssets.id });

    if (!updated.length) {
      throw new Error('Media processing lease was lost.');
    }

    if (isImage) {
      await unlink(inputPath).catch(() => undefined);
    }
  } catch (error) {
    if (asset) {
      const finalAttempt =
        job.attemptsMade + 1 >= Number(job.opts.attempts ?? 1);
      await database
        .update(mediaAssets)
        .set({
          errorCode: finalAttempt
            ? 'ffmpeg_processing_failed'
            : 'ffmpeg_processing_retry',
          leaseExpiresAt: null,
          lockedAt: null,
          lockedBy: null,
          status: finalAttempt ? 'failed' : 'processing',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mediaAssets.id, asset.id),
            eq(mediaAssets.processingGeneration, generation),
          ),
        );
    }

    await Promise.all([
      temporaryOutput ? unlink(temporaryOutput).catch(() => undefined) : null,
      temporaryThumbnail
        ? unlink(temporaryThumbnail).catch(() => undefined)
        : null,
      outputPublished && publishedOutput
        ? unlink(publishedOutput).catch(() => undefined)
        : null,
      thumbnailPublished && publishedThumbnail
        ? unlink(publishedThumbnail).catch(() => undefined)
        : null,
    ]);
    throw error;
  } finally {
    if (active) {
      endJob();
    }
    await releaseLock();
  }
}
