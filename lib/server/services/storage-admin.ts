import 'server-only';

import { statfs, unlink } from 'node:fs/promises';
import { asc, count, desc, eq, inArray, isNotNull, sum } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  assignmentAttachments,
  assignmentSubmissionAttachments,
  enrollmentDocuments,
  instructorDocuments,
  instructorProfiles,
  mediaAssets,
  messageAttachments,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { mediaRoot, resolveMediaPath } from '@/lib/server/media/paths';

export type StorageFile = {
  createdAt: string;
  id: string;
  kind: string;
  name: string;
  ownerName?: string;
  referenced: boolean;
  sizeBytes: number;
};

export type StorageOverview = {
  byKind: Array<{ bytes: number; count: number; kind: string }>;
  byUser: Array<{
    bytes: number;
    count: number;
    name?: string;
    role?: string;
    userId?: string;
  }>;
  biggest: StorageFile[];
  disk: {
    freeBytes: number;
    percent: number;
    totalBytes: number;
    usedBytes: number;
  };
  fileCount: number;
  managedBytes: number;
  oldest: StorageFile[];
  orphanBytes: number;
  orphans: StorageFile[];
};

function assertAdmin(principal: WorkspacePrincipal) {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
}

const fileColumns = {
  createdAt: mediaAssets.createdAt,
  id: mediaAssets.id,
  kind: mediaAssets.kind,
  name: mediaAssets.originalName,
  ownerName: users.name,
  sizeBytes: mediaAssets.sizeBytes,
};

type FileRow = {
  createdAt: Date;
  id: string;
  kind: string;
  name: string;
  ownerName: string | null;
  sizeBytes: number | null;
};

function toFile(row: FileRow, referenced: Set<string>): StorageFile {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    kind: row.kind,
    name: row.name,
    ownerName: row.ownerName ?? undefined,
    referenced: referenced.has(row.id),
    sizeBytes: row.sizeBytes ?? 0,
  };
}

// Every column that can keep a media asset "alive" (onDelete: restrict).
async function referencedMediaIds(): Promise<Set<string>> {
  const lists = await Promise.all([
    database
      .select({ id: messageAttachments.mediaAssetId })
      .from(messageAttachments),
    database
      .select({ id: assignmentAttachments.mediaAssetId })
      .from(assignmentAttachments),
    database
      .select({ id: assignmentSubmissionAttachments.mediaAssetId })
      .from(assignmentSubmissionAttachments),
    database
      .select({ id: instructorDocuments.mediaAssetId })
      .from(instructorDocuments),
    database
      .select({ id: enrollmentDocuments.mediaAssetId })
      .from(enrollmentDocuments),
    database
      .select({ id: instructorProfiles.photoMediaAssetId })
      .from(instructorProfiles)
      .where(isNotNull(instructorProfiles.photoMediaAssetId)),
    database
      .select({ id: users.photoMediaAssetId })
      .from(users)
      .where(isNotNull(users.photoMediaAssetId)),
  ]);
  const referenced = new Set<string>();
  for (const list of lists) {
    for (const row of list) {
      if (row.id) referenced.add(row.id);
    }
  }
  return referenced;
}

export async function getStorageOverview(
  principal: WorkspacePrincipal,
): Promise<StorageOverview> {
  assertAdmin(principal);

  const stats = await statfs(mediaRoot());
  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bavail * stats.bsize;
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const percent = totalBytes ? Math.round((usedBytes / totalBytes) * 100) : 0;

  const [totals] = await database
    .select({ bytes: sum(mediaAssets.sizeBytes), count: count() })
    .from(mediaAssets);

  const byKindRows = await database
    .select({
      bytes: sum(mediaAssets.sizeBytes),
      count: count(),
      kind: mediaAssets.kind,
    })
    .from(mediaAssets)
    .groupBy(mediaAssets.kind);

  const byUserRows = await database
    .select({
      bytes: sum(mediaAssets.sizeBytes),
      count: count(),
      name: users.name,
      role: users.role,
      userId: mediaAssets.ownerUserId,
    })
    .from(mediaAssets)
    .leftJoin(users, eq(users.id, mediaAssets.ownerUserId))
    .groupBy(mediaAssets.ownerUserId, users.name, users.role);

  const referenced = await referencedMediaIds();
  const biggestRows = await database
    .select(fileColumns)
    .from(mediaAssets)
    .leftJoin(users, eq(users.id, mediaAssets.ownerUserId))
    .where(isNotNull(mediaAssets.sizeBytes))
    .orderBy(desc(mediaAssets.sizeBytes))
    .limit(25);

  const oldestRows = await database
    .select(fileColumns)
    .from(mediaAssets)
    .leftJoin(users, eq(users.id, mediaAssets.ownerUserId))
    .orderBy(asc(mediaAssets.createdAt))
    .limit(25);

  const allRows = await database
    .select(fileColumns)
    .from(mediaAssets)
    .leftJoin(users, eq(users.id, mediaAssets.ownerUserId))
    .orderBy(desc(mediaAssets.sizeBytes));
  const orphanRows = allRows.filter((row) => !referenced.has(row.id));
  const orphanBytes = orphanRows.reduce(
    (acc, row) => acc + (row.sizeBytes ?? 0),
    0,
  );

  return {
    byKind: byKindRows
      .map((row) => ({
        bytes: Number(row.bytes ?? 0),
        count: Number(row.count),
        kind: row.kind,
      }))
      .sort((a, b) => b.bytes - a.bytes),
    byUser: byUserRows
      .map((row) => ({
        bytes: Number(row.bytes ?? 0),
        count: Number(row.count),
        name: row.name ?? undefined,
        role: row.role ?? undefined,
        userId: row.userId ?? undefined,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 50),
    biggest: biggestRows.map((row) => toFile(row, referenced)),
    disk: { freeBytes, percent, totalBytes, usedBytes },
    fileCount: Number(totals?.count ?? 0),
    managedBytes: Number(totals?.bytes ?? 0),
    oldest: oldestRows.map((row) => toFile(row, referenced)),
    orphanBytes,
    orphans: orphanRows.slice(0, 60).map((row) => toFile(row, referenced)),
  };
}

export type UserStorageDetail = {
  byKind: Array<{ bytes: number; count: number; kind: string }>;
  files: StorageFile[];
  name?: string;
  role?: string;
  totalBytes: number;
};

export async function getUserStorageDetail(
  principal: WorkspacePrincipal,
  userId: string,
): Promise<UserStorageDetail> {
  assertAdmin(principal);

  const [user] = await database
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const referenced = await referencedMediaIds();
  const rows = await database
    .select(fileColumns)
    .from(mediaAssets)
    .leftJoin(users, eq(users.id, mediaAssets.ownerUserId))
    .where(eq(mediaAssets.ownerUserId, userId))
    .orderBy(desc(mediaAssets.sizeBytes))
    .limit(200);

  const byKindRows = await database
    .select({
      bytes: sum(mediaAssets.sizeBytes),
      count: count(),
      kind: mediaAssets.kind,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.ownerUserId, userId))
    .groupBy(mediaAssets.kind);

  return {
    byKind: byKindRows
      .map((row) => ({
        bytes: Number(row.bytes ?? 0),
        count: Number(row.count),
        kind: row.kind,
      }))
      .sort((a, b) => b.bytes - a.bytes),
    files: rows.map((row) => toFile(row, referenced)),
    name: user?.name ?? undefined,
    role: user?.role ?? undefined,
    totalBytes: rows.reduce((acc, row) => acc + (row.sizeBytes ?? 0), 0),
  };
}

// Resolved disk paths + names for a set of media ids (for the ZIP download).
export async function getMediaForDownload(
  principal: WorkspacePrincipal,
  mediaIds: string[],
): Promise<Array<{ name: string; path: string }>> {
  assertAdmin(principal);
  if (!mediaIds.length) return [];

  const rows = await database
    .select({
      name: mediaAssets.originalName,
      outputPath: mediaAssets.outputPath,
    })
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, mediaIds.slice(0, 300)));

  return rows
    .filter((row): row is { name: string; outputPath: string } =>
      Boolean(row.outputPath),
    )
    .map((row) => ({
      name: row.name,
      path: resolveMediaPath(row.outputPath),
    }));
}

export async function deleteOrphanMedia(
  principal: WorkspacePrincipal,
  mediaId: string,
): Promise<void> {
  assertAdmin(principal);

  const [asset] = await database
    .select({
      id: mediaAssets.id,
      outputPath: mediaAssets.outputPath,
      sourcePath: mediaAssets.sourcePath,
      thumbnailPath: mediaAssets.thumbnailPath,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
    .limit(1);
  if (!asset) {
    throw new PublicFlowError('media_not_found', 404);
  }

  const referenced = await referencedMediaIds();
  if (referenced.has(mediaId)) {
    throw new PublicFlowError('media_in_use', 409);
  }

  for (const relative of [
    asset.sourcePath,
    asset.outputPath,
    asset.thumbnailPath,
  ]) {
    if (relative) {
      await unlink(resolveMediaPath(relative)).catch(() => undefined);
    }
  }
  await database.delete(mediaAssets).where(eq(mediaAssets.id, mediaId));
}
