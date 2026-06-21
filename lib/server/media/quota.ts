import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import { mediaAssets } from '@/lib/server/db/schema';
import { getRuntimeEnv } from '@/lib/server/env';
import { MediaQuotaExceededError } from '@/lib/server/http/errors';

// Statuses that occupy disk (or are about to). 'failed'/'quarantined' do not
// count against the user's quota.
const COUNTED_STATUSES = [
  'uploaded',
  'scanning',
  'processing',
  'ready',
] as const;

export async function getUserStorageUsage(
  ownerUserId: string,
): Promise<number> {
  const [row] = await database
    .select({
      total: sql<string>`coalesce(sum(${mediaAssets.sizeBytes}), 0)`,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.ownerUserId, ownerUserId),
        inArray(mediaAssets.status, COUNTED_STATUSES),
      ),
    );
  return Number(row?.total ?? 0);
}

// Throws MediaQuotaExceededError if storing `incomingBytes` more would push the
// user over their per-user quota. A quota of 0 disables enforcement.
export async function assertUserQuota(
  ownerUserId: string,
  incomingBytes: number,
): Promise<void> {
  const quota = getRuntimeEnv().MEDIA_PER_USER_QUOTA_BYTES;
  if (quota <= 0) return;

  const used = await getUserStorageUsage(ownerUserId);
  if (used + incomingBytes > quota) {
    throw new MediaQuotaExceededError();
  }
}
