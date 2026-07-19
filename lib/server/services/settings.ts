import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { database } from '@/lib/server/db/client';
import { workspaceSettings } from '@/lib/server/db/schema';

export type MailMode = 'live' | 'test';

export type SettingValues = {
  installmentReminderDays: number;
  joinLeadMinutes: number;
  lessonAutoCloseHours: number;
  mailMode: MailMode;
  paymentReviewStaleDays: number;
};

export type SettingKey = keyof SettingValues;

export const SETTING_DEFAULTS: SettingValues = {
  installmentReminderDays: 3,
  joinLeadMinutes: 15,
  lessonAutoCloseHours: 3,
  mailMode: 'live',
  paymentReviewStaleDays: 3,
};

const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

// Per-key validators: coerce a raw jsonb value to the typed setting, or return
// undefined when the stored value doesn't match its expected shape (then the
// caller falls back to the default). Keeps the mixed-type store type-safe.
const SETTING_VALIDATORS: {
  [K in SettingKey]: (value: unknown) => SettingValues[K] | undefined;
} = {
  installmentReminderDays: (value) =>
    typeof value === 'number' ? value : undefined,
  joinLeadMinutes: (value) => (typeof value === 'number' ? value : undefined),
  lessonAutoCloseHours: (value) =>
    typeof value === 'number' ? value : undefined,
  mailMode: (value) =>
    value === 'live' || value === 'test' ? value : undefined,
  paymentReviewStaleDays: (value) =>
    typeof value === 'number' ? value : undefined,
};

function coerce<K extends SettingKey>(key: K, value: unknown): SettingValues[K] {
  const validate = SETTING_VALIDATORS[key] as (
    value: unknown,
  ) => SettingValues[K] | undefined;
  return validate(value) ?? SETTING_DEFAULTS[key];
}

export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValues[K]> {
  const [row] = await database
    .select({ value: workspaceSettings.value })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.key, key))
    .limit(1);

  return coerce(key, row?.value);
}

export async function getAllSettings(): Promise<SettingValues> {
  const rows = await database
    .select({ key: workspaceSettings.key, value: workspaceSettings.value })
    .from(workspaceSettings)
    .where(inArray(workspaceSettings.key, SETTING_KEYS));

  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    installmentReminderDays: coerce(
      'installmentReminderDays',
      byKey.get('installmentReminderDays'),
    ),
    joinLeadMinutes: coerce('joinLeadMinutes', byKey.get('joinLeadMinutes')),
    lessonAutoCloseHours: coerce(
      'lessonAutoCloseHours',
      byKey.get('lessonAutoCloseHours'),
    ),
    mailMode: coerce('mailMode', byKey.get('mailMode')),
    paymentReviewStaleDays: coerce(
      'paymentReviewStaleDays',
      byKey.get('paymentReviewStaleDays'),
    ),
  };
}

/** Current mail delivery mode (live SMTP vs Mailpit capture). */
export function getMailMode(): Promise<MailMode> {
  return getSetting('mailMode');
}

export async function updateSettings(
  updates: Partial<SettingValues>,
  updatedByUserId: string,
): Promise<SettingValues> {
  const now = new Date();
  const entries = (
    Object.entries(updates) as Array<[SettingKey, number | string]>
  ).filter(
    ([key, value]) =>
      SETTING_KEYS.includes(key) &&
      SETTING_VALIDATORS[key](value) !== undefined,
  );

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
