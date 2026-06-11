import 'server-only';

import { ensureRedisConnection, prefixedRedisKey, redis } from './client';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  await ensureRedisConnection();
  const [count, ttl] = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    prefixedRedisKey(`rate:${key}`),
    windowMs,
  )) as [number, number];

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: Date.now() + Math.max(0, ttl),
  };
}
