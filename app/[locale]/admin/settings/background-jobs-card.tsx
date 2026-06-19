'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Activity, RefreshCw } from 'lucide-react';
import { Button, ModulePanel, StatusChip } from '@/components/ui';

type OutboxStatus =
  | 'dead'
  | 'failed'
  | 'pending'
  | 'processing'
  | 'queued'
  | 'sent';

type BackgroundJobStatus = {
  lastError?: {
    createdAt: string;
    id: string;
    message: string;
    status: 'failed' | 'dead';
    templateKey: string;
  };
  notificationCounts: Record<OutboxStatus, number>;
  releaseId: string;
  worker?: {
    activeJobs: number;
    healthy: boolean;
    id: string;
    lastSeenAt: string;
    stale: boolean;
    type: string;
  };
};

export function BackgroundJobsCard() {
  const t = useTranslations('admin.settings.backgroundJobs');
  const locale = useLocale();
  const [status, setStatus] = useState<BackgroundJobStatus>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const retryableCount = useMemo(() => {
    if (!status) return 0;
    return status.notificationCounts.failed + status.notificationCounts.dead;
  }, [status]);

  async function refresh() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/ops/background-jobs', {
        credentials: 'same-origin',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'status_failed'));
      setStatus(body.status);
    } catch {
      setMessage(t('statusError'));
    } finally {
      setBusy(false);
    }
  }

  async function retryFailed() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/ops/background-jobs', {
        credentials: 'same-origin',
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'retry_failed'));
      setStatus(body.status);
      setMessage(t('retrySuccess', { count: body.result?.requeued ?? 0 }));
    } catch {
      setMessage(t('retryError'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModulePanel>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#533089]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#533089]">
            <Activity className="h-4 w-4" />
            {t('badge')}
          </div>
          <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
            {t('title')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#2E286C]/65">
            {t('description')}
          </p>
        </div>
        <StatusChip tone={status?.worker?.healthy ? 'emerald' : 'amber'}>
          {status?.worker?.healthy ? t('workerOnline') : t('workerOffline')}
        </StatusChip>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Metric label={t('pending')} value={status?.notificationCounts.pending ?? 0} />
        <Metric label={t('failed')} value={status?.notificationCounts.failed ?? 0} />
        <Metric label={t('dead')} value={status?.notificationCounts.dead ?? 0} />
      </div>

      <div className="mt-5 rounded-2xl bg-[#F8F7FB] p-4 text-sm font-medium leading-6 text-[#2E286C]/65">
        {status?.worker ? (
          <>
            <div className="font-bold text-[#2E286C]">{status.worker.id}</div>
            <div>
              {t('lastSeen', {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: 'short',
                  timeStyle: 'medium',
                }).format(new Date(status.worker.lastSeenAt)),
              })}
            </div>
            <div>{t('activeJobs', { count: status.worker.activeJobs })}</div>
          </>
        ) : (
          t('noHeartbeat')
        )}
      </div>

      {status?.lastError && (
        <div className="mt-4 rounded-2xl bg-[#B42318]/8 p-4 text-sm font-semibold leading-6 text-[#B42318]">
          <div>{t('lastError')}</div>
          <div className="mt-1 break-words text-xs font-medium">
            {status.lastError.templateKey}: {status.lastError.message}
          </div>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-2xl bg-[#533089]/8 px-4 py-3 text-sm font-semibold text-[#533089]">
          {message}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" disabled={busy} onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          {t('refresh')}
        </Button>
        <Button type="button" disabled={busy || retryableCount === 0} onClick={retryFailed}>
          <RefreshCw className="h-4 w-4" />
          {t('retryFailed')}
        </Button>
      </div>
    </ModulePanel>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#F8F7FB] p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#2E286C]/40">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-[#2E286C]">{value}</div>
    </div>
  );
}
