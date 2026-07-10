import 'server-only';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getRuntimeEnv } from '@/lib/server/env';
import * as schema from './schema';

const globalForDatabase = globalThis as unknown as {
  zumraPool?: Pool;
  zumraDatabase?: ReturnType<typeof createDatabase>;
};

function createPool() {
  const env = getRuntimeEnv();
  const ssl =
    env.DATABASE_SSL_MODE === 'disable'
      ? false
      : { rejectUnauthorized: env.DATABASE_SSL_MODE === 'verify-full' };

  return new Pool({
    connectionString: env.DATABASE_URL,
    application_name: 'zumra-web',
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    // Checkout waits (incl. queueing behind a saturated pool) count against
    // this; dev compile bursts + a small pool need the extra headroom.
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    ssl,
  });
}

function createDatabase(pool: Pool) {
  return drizzle(pool, {
    schema,
    casing: 'snake_case',
  });
}

export const databasePool = globalForDatabase.zumraPool ?? createPool();
export const database =
  globalForDatabase.zumraDatabase ?? createDatabase(databasePool);

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.zumraPool = databasePool;
  globalForDatabase.zumraDatabase = database;
}

export async function checkDatabaseConnection() {
  const client = await databasePool.connect();

  try {
    const result = await client.query<{ now: Date }>('select now() as now');
    return result.rows[0]?.now;
  } finally {
    client.release();
  }
}
