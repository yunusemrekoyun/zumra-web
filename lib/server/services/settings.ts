import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import { workspaceSettings } from '@/lib/server/db/schema';

export const SETTING_DEFAULTS = {
  joinLeadMinutes: 15,
  lessonAutoCloseHours: 3,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

export async function getSetting(key: SettingKey): Promise<number> {
  const [row] = await database
    .select({ value: workspaceSettings.value })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.key, key))
    .limit(1);

  return typeof row?.value === 'number' ? row.value : SETTING_DEFAULTS[key];
}

export async function getAllSettings(): Promise<Record<SettingKey, number>> {
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
  }

  return getAllSettings();
}
