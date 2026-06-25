import 'server-only';

import { inArray } from 'drizzle-orm';
import { revalidateTag, unstable_cache } from 'next/cache';
import { database } from '@/lib/server/db/client';
import { workspaceSettings } from '@/lib/server/db/schema';

export const SETTING_DEFAULTS = {
  joinLeadMinutes: 15,
  lessonAutoCloseHours: 3,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];
const SETTINGS_CACHE_TAG = 'workspace-settings';

// Settings change rarely but are read on most page renders. Cache the whole set
// across requests and refresh it on update (revalidateTag below), so individual
// renders skip the database entirely.
const readAllSettings = unstable_cache(
  async (): Promise<Record<SettingKey, number>> => {
    const rows = await database
      .select({ key: workspaceSettings.key, value: workspaceSettings.value })
      .from(workspaceSettings)
      .where(inArray(workspaceSettings.key, SETTING_KEYS));

    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    return SETTING_KEYS.reduce(
      (acc, key) => {
        const value = byKey.get(key);
        acc[key] = typeof value === 'number' ? value : SETTING_DEFAULTS[key];
        return acc;
      },
      {} as Record<SettingKey, number>,
    );
  },
  [SETTINGS_CACHE_TAG],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);

export async function getSetting(key: SettingKey): Promise<number> {
  return (await readAllSettings())[key];
}

export async function getAllSettings(): Promise<Record<SettingKey, number>> {
  return readAllSettings();
}

export async function updateSettings(
  updates: Partial<Record<SettingKey, number>>,
  updatedByUserId: string,
): Promise<Record<SettingKey, number>> {
  const now = new Date();
  const entries = Object.entries(updates).filter(
    ([key, value]) =>
      SETTING_KEYS.includes(key as SettingKey) && typeof value === 'number',
  ) as Array<[SettingKey, number]>;

  if (entries.length) {
    await database.transaction(async (transaction) => {
      for (const [key, value] of entries) {
        await transaction
          .insert(workspaceSettings)
          .values({ createdAt: now, key, updatedAt: now, updatedByUserId, value })
          .onConflictDoUpdate({
            target: workspaceSettings.key,
            set: { updatedAt: now, updatedByUserId, value },
          });
      }
    });
    try {
      revalidateTag(SETTINGS_CACHE_TAG);
    } catch {
      // revalidateTag only works inside a request scope; the 60s TTL covers
      // other callers (scripts/tests).
    }
  }

  return getAllSettings();
}
