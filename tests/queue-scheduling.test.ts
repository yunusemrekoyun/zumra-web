import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { ensureJobScheduled } from '@/lib/server/queues/ensure-job';

describe('ensureJobScheduled', () => {
  it('keeps an already runnable deterministic job', async () => {
    const existing = {
      getState: vi.fn().mockResolvedValue('waiting'),
      remove: vi.fn(),
    };
    const queue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValue(existing),
    } as unknown as Queue;

    await expect(
      ensureJobScheduled(queue, {
        data: { id: '1' },
        jobId: 'job-1',
        name: 'deliver',
      }),
    ).resolves.toBe(existing);
    expect(existing.remove).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('replaces retained failed jobs so DB reconciliation can retry them', async () => {
    const replacement = { id: 'job-1' };
    const existing = {
      getState: vi.fn().mockResolvedValue('failed'),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      add: vi.fn().mockResolvedValue(replacement),
      getJob: vi.fn().mockResolvedValue(existing),
    } as unknown as Queue;

    await expect(
      ensureJobScheduled(queue, {
        data: { id: '1' },
        jobId: 'job-1',
        name: 'deliver',
      }),
    ).resolves.toBe(replacement);
    expect(existing.remove).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledWith(
      'deliver',
      { id: '1' },
      { jobId: 'job-1' },
    );
  });
});
