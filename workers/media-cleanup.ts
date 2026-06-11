import { randomUUID } from 'node:crypto';
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import { mediaAssets } from '@/lib/server/db/schema';
import {
  resolveMediaPath,
  sourceRelativePath,
} from '@/lib/server/media/paths';
import { getRuntimeEnv } from '@/lib/server/env';
import { auditService } from '@/lib/server/services/audit';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const STALE_UPLOAD_AGE_MS = 2 * 60 * 60 * 1000;

async function failStaleUploads() {
  const cutoff = new Date(Date.now() - STALE_UPLOAD_AGE_MS);
  const assets = await database
    .select({
      id: mediaAssets.id,
      sourcePath: mediaAssets.sourcePath,
      status: mediaAssets.status,
    })
    .from(mediaAssets)
    .where(
      and(
        inArray(mediaAssets.status, ['uploading', 'uploaded', 'scanning']),
        lte(mediaAssets.updatedAt, cutoff),
      ),
    )
    .limit(100);

  for (const asset of assets) {
    const [failed] = await database
      .update(mediaAssets)
      .set({
        errorCode: 'stale_upload_recovered',
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mediaAssets.id, asset.id),
          eq(mediaAssets.status, asset.status),
          lte(mediaAssets.updatedAt, cutoff),
        ),
      )
      .returning({ id: mediaAssets.id });

    if (!failed) {
      continue;
    }

    const relativePath = asset.sourcePath ?? sourceRelativePath(asset.id);
    await unlink(resolveMediaPath(relativePath)).catch((error) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    });

    await database
      .update(mediaAssets)
      .set({
        sourcePath: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mediaAssets.id, asset.id),
          eq(mediaAssets.status, 'failed'),
        ),
      );
  }
}

async function removeExpiredSources() {
  const assets = await database
    .select({
      id: mediaAssets.id,
      sourcePath: mediaAssets.sourcePath,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.status, 'ready'),
        isNotNull(mediaAssets.sourcePath),
        isNotNull(mediaAssets.backupVerifiedAt),
        isNotNull(mediaAssets.backupSnapshotId),
        lte(mediaAssets.sourceDeleteAfter, new Date()),
      ),
    )
    .limit(100);

  for (const asset of assets) {
    if (!asset.sourcePath?.startsWith('quarantine/')) {
      continue;
    }

    try {
      await unlink(resolveMediaPath(asset.sourcePath));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }

    await database
      .update(mediaAssets)
      .set({
        sourcePath: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mediaAssets.id, asset.id),
          eq(mediaAssets.sourcePath, asset.sourcePath),
        ),
      );
  }
}

async function removeExpiredQuarantine() {
  const assets = await database
    .select({
      id: mediaAssets.id,
      sourcePath: mediaAssets.sourcePath,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.status, 'quarantined'),
        isNotNull(mediaAssets.sourcePath),
        isNotNull(mediaAssets.quarantineDeleteAfter),
        lte(mediaAssets.quarantineDeleteAfter, new Date()),
      ),
    )
    .limit(100);

  for (const asset of assets) {
    if (asset.sourcePath) {
      await unlink(resolveMediaPath(asset.sourcePath)).catch((error) => {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
          throw error;
        }
      });
    }

    await database
      .update(mediaAssets)
      .set({
        sourcePath: null,
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, asset.id));

    await auditService.record({
      action: 'media.quarantine_expired',
      requestId: randomUUID(),
      result: 'success',
      targetId: asset.id,
      targetType: 'media_asset',
    });
  }
}

async function removeStaleRuntimeFiles() {
  const env = getRuntimeEnv();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const directories = [
    resolveMediaPath('tmp'),
    path.join(path.resolve(env.MEDIA_JOB_ROOT), 'inbox'),
    path.join(path.resolve(env.MEDIA_JOB_ROOT), 'processing'),
    path.join(path.resolve(env.MEDIA_JOB_ROOT), 'results'),
  ];

  for (const directory of directories) {
    const names = await readdir(directory).catch(() => []);

    for (const name of names) {
      const filePath = path.join(directory, name);
      const fileStat = await stat(filePath).catch(() => null);

      if (fileStat?.isFile() && fileStat.mtimeMs < cutoff) {
        await unlink(filePath).catch(() => undefined);
      }
    }
  }
}

export function startMediaSourceCleanup() {
  const run = () => {
    void Promise.all([
      failStaleUploads(),
      removeExpiredSources(),
      removeExpiredQuarantine(),
      removeStaleRuntimeFiles(),
    ]).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'media.source_cleanup_failed',
          message: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      );
    });
  };

  run();
  const interval = setInterval(run, CLEANUP_INTERVAL_MS);
  return () => clearInterval(interval);
}
