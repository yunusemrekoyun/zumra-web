import 'server-only';

import { eq } from 'drizzle-orm';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { database } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';
import { PublicFlowError } from '@/lib/server/http/errors';

export function isValidTimezone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The viewer's display timezone; falls back to the academy default. */
export async function getUserTimezone(userId: string): Promise<string> {
  const [row] = await database
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const stored = row?.timezone;
  return stored && isValidTimezone(stored) ? stored : APP_TIME_ZONE;
}

export async function updateUserTimezone(
  userId: string,
  timezone: string | null,
): Promise<{ timezone: string }> {
  if (timezone !== null && !isValidTimezone(timezone)) {
    throw new PublicFlowError('invalid_timezone', 400);
  }

  await database
    .update(users)
    .set({ timezone, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { timezone: timezone ?? APP_TIME_ZONE };
}
