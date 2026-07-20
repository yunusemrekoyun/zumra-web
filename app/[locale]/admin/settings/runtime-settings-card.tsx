'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Save, SlidersHorizontal } from 'lucide-react';
import { Button, Input, ModulePanel } from '@/components/ui';

export function RuntimeSettingsCard() {
  const t = useTranslations('admin.settings.runtimeSettings');
  const [joinLeadMinutes, setJoinLeadMinutes] = useState('15');
  const [autoCloseHours, setAutoCloseHours] = useState('3');
  const [installmentReminderDays, setInstallmentReminderDays] = useState('3');
  const [paymentReviewStaleDays, setPaymentReviewStaleDays] = useState('3');
  const [lessonChangeCutoffHours, setLessonChangeCutoffHours] = useState('12');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          credentials: 'same-origin',
        });
        const body = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok && body.settings) {
          setJoinLeadMinutes(String(body.settings.joinLeadMinutes));
          setAutoCloseHours(String(body.settings.lessonAutoCloseHours));
          setInstallmentReminderDays(
            String(body.settings.installmentReminderDays),
          );
          setPaymentReviewStaleDays(
            String(body.settings.paymentReviewStaleDays),
          );
          setLessonChangeCutoffHours(
            String(body.settings.lessonChangeCutoffHours),
          );
          setLoadFailed(false);
        } else {
          // Saving with the hardcoded defaults would silently overwrite the
          // real stored values, so surface the failure and block the form.
          setLoadFailed(true);
        }
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadToken]);

  function retryLoad() {
    setLoading(true);
    setMessage(undefined);
    setReloadToken((token) => token + 1);
  }

  async function save() {
    if (loading || loadFailed) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/admin/settings', {
        body: JSON.stringify({
          installmentReminderDays: Number(installmentReminderDays),
          joinLeadMinutes: Number(joinLeadMinutes),
          lessonAutoCloseHours: Number(autoCloseHours),
          lessonChangeCutoffHours: Number(lessonChangeCutoffHours),
          paymentReviewStaleDays: Number(paymentReviewStaleDays),
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'update_failed'));
      if (body.settings) {
        setJoinLeadMinutes(String(body.settings.joinLeadMinutes));
        setAutoCloseHours(String(body.settings.lessonAutoCloseHours));
        setInstallmentReminderDays(
          String(body.settings.installmentReminderDays),
        );
        setPaymentReviewStaleDays(String(body.settings.paymentReviewStaleDays));
        setLessonChangeCutoffHours(
          String(body.settings.lessonChangeCutoffHours),
        );
      }
      setMessage({ text: t('success'), type: 'success' });
    } catch {
      setMessage({ text: t('error'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModulePanel>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#533089]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#533089]">
        <SlidersHorizontal className="h-4 w-4" />
        {t('badge')}
      </div>
      <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
        {t('title')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#2E286C]/65">
        {t('description')}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {t('joinLeadMinutes')}
          <Input
            type="number"
            min={0}
            max={120}
            value={joinLeadMinutes}
            disabled={loading || busy || loadFailed}
            onChange={(event) => setJoinLeadMinutes(event.target.value)}
          />
          <span className="text-[11px] font-semibold normal-case tracking-normal text-[#2E286C]/45">
            {t('joinLeadMinutesHint')}
          </span>
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {t('lessonAutoCloseHours')}
          <Input
            type="number"
            min={1}
            max={48}
            value={autoCloseHours}
            disabled={loading || busy || loadFailed}
            onChange={(event) => setAutoCloseHours(event.target.value)}
          />
          <span className="text-[11px] font-semibold normal-case tracking-normal text-[#2E286C]/45">
            {t('lessonAutoCloseHoursHint')}
          </span>
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {t('installmentReminderDays')}
          <Input
            type="number"
            min={0}
            max={30}
            value={installmentReminderDays}
            disabled={loading || busy || loadFailed}
            onChange={(event) => setInstallmentReminderDays(event.target.value)}
          />
          <span className="text-[11px] font-semibold normal-case tracking-normal text-[#2E286C]/45">
            {t('installmentReminderDaysHint')}
          </span>
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {t('paymentReviewStaleDays')}
          <Input
            type="number"
            min={1}
            max={30}
            value={paymentReviewStaleDays}
            disabled={loading || busy || loadFailed}
            onChange={(event) => setPaymentReviewStaleDays(event.target.value)}
          />
          <span className="text-[11px] font-semibold normal-case tracking-normal text-[#2E286C]/45">
            {t('paymentReviewStaleDaysHint')}
          </span>
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {t('lessonChangeCutoffHours')}
          <Input
            type="number"
            min={0}
            max={168}
            value={lessonChangeCutoffHours}
            disabled={loading || busy || loadFailed}
            onChange={(event) => setLessonChangeCutoffHours(event.target.value)}
          />
          <span className="text-[11px] font-semibold normal-case tracking-normal text-[#2E286C]/45">
            {t('lessonChangeCutoffHoursHint')}
          </span>
        </label>
      </div>

      {!loading && loadFailed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]">
          {t('loadError')}
          <button
            type="button"
            onClick={retryLoad}
            className="rounded-full bg-[#B42318]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#B42318] transition-colors hover:bg-[#B42318]/20"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {message && (
        <div
          className={
            message.type === 'success'
              ? 'mt-4 rounded-2xl bg-[#0F9F6E]/10 px-4 py-3 text-sm font-semibold text-[#0B7F58]'
              : 'mt-4 rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </div>
      )}

      <Button
        className="mt-5"
        disabled={loading || busy || loadFailed}
        onClick={save}
      >
        <Save className="h-4 w-4" />
        {busy ? t('saving') : t('save')}
      </Button>
    </ModulePanel>
  );
}
