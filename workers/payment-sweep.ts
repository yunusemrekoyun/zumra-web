import { tryAcquireAdvisoryLock } from '@/lib/server/db/advisory-lock';
import {
  sweepInstallmentReminders,
  sweepStalePaymentReviews,
} from '@/lib/server/services/payment-sweeps';
import { sweepTaskDueReminders } from '@/lib/server/services/task-sweeps';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

async function withSweepLock(key: string, run: () => Promise<unknown>) {
  const release = await tryAcquireAdvisoryLock(key);
  if (!release) return;
  try {
    await run();
  } finally {
    await release();
  }
}

// Hourly payment sweeps: installment due reminders for students and a staff
// warning when reported payments sit unreviewed for too long. Both dedupe to
// at most one notification per subject per day, so the hourly tick only
// controls how quickly a new day's reminders go out.
export function startPaymentSweeps() {
  const run = () => {
    void withSweepLock('sweep:payment-installment-due', () =>
      sweepInstallmentReminders(),
    ).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'payment.installment_sweep_failed',
          message: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      );
    });

    void withSweepLock('sweep:payment-review-stale', () =>
      sweepStalePaymentReviews(),
    ).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'payment.review_stale_sweep_failed',
          message: error instanceof Error ? error.message : 'unknown',
          timestamp: new Date().toISOString(),
        }),
      );
    });

    void withSweepLock('sweep:task-due', () => sweepTaskDueReminders()).catch(
      (error) => {
        console.error(
          JSON.stringify({
            event: 'task.due_sweep_failed',
            message: error instanceof Error ? error.message : 'unknown',
            timestamp: new Date().toISOString(),
          }),
        );
      },
    );
  };

  run();
  const interval = setInterval(run, SWEEP_INTERVAL_MS);
  return () => clearInterval(interval);
}
