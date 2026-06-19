import 'server-only';

import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { getRuntimeEnv } from '@/lib/server/env';

export const queueNames = {
  meet: 'zumra-meet',
  media: 'zumra-media',
  notifications: 'zumra-notifications',
} as const;

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    delay: 2_000,
    type: 'exponential',
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1_000,
  },
  removeOnFail: false,
};

const lastConnectionErrorAt = new Map<string, number>();

export function reportQueueConnectionError(
  component: string,
  error: Error,
) {
  const now = Date.now();
  const lastReportedAt = lastConnectionErrorAt.get(component) ?? 0;

  if (now - lastReportedAt < 5_000) {
    return;
  }

  lastConnectionErrorAt.set(component, now);
  console.error(
    JSON.stringify({
      component,
      event: 'queue.connection_error',
      message: error.message.slice(0, 500),
      timestamp: new Date(now).toISOString(),
    }),
  );
}

export function getBullConnection(): ConnectionOptions {
  const url = new URL(getRuntimeEnv().REDIS_URL);

  return {
    host: url.hostname,
    maxRetriesPerRequest: null,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 6379),
    username: decodeURIComponent(url.username),
  };
}
