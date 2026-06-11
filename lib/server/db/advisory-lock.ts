import 'server-only';

import { databasePool } from '@/lib/server/db/client';

export async function tryAcquireAdvisoryLock(key: string) {
  const client = await databasePool.connect();

  try {
    const result = await client.query<{ acquired: boolean }>(
      'select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired',
      [key],
    );

    if (!result.rows[0]?.acquired) {
      client.release();
      return null;
    }

    let released = false;

    return async () => {
      if (released) {
        return;
      }

      released = true;

      try {
        await client.query(
          'select pg_advisory_unlock(hashtextextended($1, 0))',
          [key],
        );
      } finally {
        client.release();
      }
    };
  } catch (error) {
    client.release(true);
    throw error;
  }
}
