import 'server-only';

import type { JobsOptions, Queue } from 'bullmq';

type EnsureJobInput<T> = {
  data: T;
  jobId: string;
  name: string;
  options?: JobsOptions;
};

const ACTIVE_STATES = new Set([
  'active',
  'delayed',
  'paused',
  'prioritized',
  'waiting',
  'waiting-children',
]);

export async function ensureJobScheduled<T>(
  queue: Queue,
  input: EnsureJobInput<T>,
) {
  const existing = await queue.getJob(input.jobId);

  if (existing) {
    const state = await existing.getState();

    if (ACTIVE_STATES.has(state)) {
      return existing;
    }

    if (state === 'failed' || state === 'completed') {
      await existing.remove();
    }
  }

  try {
    return await queue.add(input.name, input.data, {
      ...input.options,
      jobId: input.jobId,
    });
  } catch (error) {
    const racedJob = await queue.getJob(input.jobId);

    if (racedJob) {
      return racedJob;
    }

    throw error;
  }
}
