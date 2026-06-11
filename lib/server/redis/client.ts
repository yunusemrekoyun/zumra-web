import 'server-only';

import Redis from 'ioredis';
import { getRuntimeEnv } from '@/lib/server/env';

const globalForRedis = globalThis as unknown as {
  zumraRedis?: Redis;
  zumraRedisConnection?: Promise<void>;
};

function createRedisClient() {
  const redisClient = new Redis(getRuntimeEnv().REDIS_URL, {
    connectionName: 'zumra-web',
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      return Math.min(times * 200, 2_000);
    },
  });

  redisClient.on('error', (error) => {
    console.error(
      JSON.stringify({
        event: 'redis.error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  return redisClient;
}

export const redis = globalForRedis.zumraRedis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.zumraRedis = redis;
}

export async function waitForRedisReady(
  redisClient: Redis,
  timeoutMs = 10_000,
) {
  if (redisClient.status === 'ready') {
    return;
  }

  if (
    redisClient.status === 'wait' ||
    redisClient.status === 'end'
  ) {
    await redisClient.connect();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      redisClient.off('ready', handleReady);
      redisClient.off('end', handleEnd);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleEnd = () => {
      cleanup();
      reject(new Error('Redis connection ended before becoming ready.'));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Redis did not become ready within ${timeoutMs}ms (status: ${redisClient.status}).`,
        ),
      );
    }, timeoutMs);

    redisClient.once('ready', handleReady);
    redisClient.once('end', handleEnd);

    if (redisClient.status === 'ready') {
      handleReady();
    }
  });
}

export async function ensureRedisConnection() {
  const pendingConnection =
    globalForRedis.zumraRedisConnection ??
    (async () => {
      await waitForRedisReady(redis);

      try {
        await redis.ping();
      } catch {
        // A socket can briefly report ready after it has stopped accepting
        // writes. Recreate it once so requests do not inherit a stale stream.
        redis.disconnect(false);
        await waitForRedisReady(redis);
        await redis.ping();
      }
    })();

  globalForRedis.zumraRedisConnection = pendingConnection;

  try {
    await pendingConnection;
  } finally {
    if (globalForRedis.zumraRedisConnection === pendingConnection) {
      globalForRedis.zumraRedisConnection = undefined;
    }
  }

  return 'PONG';
}

export function prefixedRedisKey(key: string) {
  return `zumra:${key}`;
}
