import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import type { WorkspacePrincipal } from '@/lib/domain';
import { database } from '@/lib/server/db/client';
import {
  instructorProfiles,
  mediaAssets,
  users,
} from '@/lib/server/db/schema';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';

async function assertReadyPrivateImage(mediaAssetId: string) {
  const [asset] = await database
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, mediaAssetId),
        eq(mediaAssets.status, 'ready'),
        eq(mediaAssets.visibility, 'private'),
        eq(mediaAssets.kind, 'image'),
      ),
    )
    .limit(1);
  if (!asset) throw new PublicFlowError('media_not_ready', 409);
}

/** Everyone manages their own photo, whatever their role. */
export async function setOwnProfilePhoto(
  principal: WorkspacePrincipal,
  mediaAssetId: string | null,
): Promise<void> {
  if (mediaAssetId) {
    await assertReadyPrivateImage(mediaAssetId);
  }
  await database
    .update(users)
    .set({ photoMediaAssetId: mediaAssetId, updatedAt: new Date() })
    .where(eq(users.id, principal.id));
}

/** Admin moderation path: set or clear anyone's photo. */
export async function setUserProfilePhoto(
  principal: WorkspacePrincipal,
  userId: string,
  mediaAssetId: string | null,
): Promise<void> {
  if (principal.role !== 'admin') {
    throw new AuthorizationDeniedError('Admin access is required.');
  }
  if (mediaAssetId) {
    await assertReadyPrivateImage(mediaAssetId);
  }
  const updated = await database
    .update(users)
    .set({ photoMediaAssetId: mediaAssetId, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!updated.length) throw new PublicFlowError('user_not_found', 404);
}

/** Resolves to a servable URL only when the asset is still ready. */
export async function getProfilePhotoUrl(
  userId: string,
): Promise<string | null> {
  const map = await getProfilePhotoUrls([userId]);
  return map.get(userId) ?? null;
}

export async function getProfilePhotoUrls(
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const rows = await database
    .select({ assetId: mediaAssets.id, userId: users.id })
    .from(users)
    .innerJoin(
      mediaAssets,
      and(
        eq(mediaAssets.id, users.photoMediaAssetId),
        eq(mediaAssets.status, 'ready'),
      ),
    )
    .where(inArray(users.id, ids));
  return new Map(rows.map((row) => [row.userId, `/api/media/${row.assetId}`]));
}

/**
 * Read-authorization hook: a media asset that is someone's profile photo is
 * visible to every active session (photos appear in shared lists, chat and
 * pickers across roles).
 */
export async function isProfilePhotoAsset(assetId: string): Promise<boolean> {
  const [userRef] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.photoMediaAssetId, assetId))
    .limit(1);
  if (userRef) return true;
  const [instructorRef] = await database
    .select({ id: instructorProfiles.id })
    .from(instructorProfiles)
    .where(eq(instructorProfiles.photoMediaAssetId, assetId))
    .limit(1);
  return Boolean(instructorRef);
}
