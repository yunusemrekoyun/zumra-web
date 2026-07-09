'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarCheck, Check, X } from 'lucide-react';
import { StatusChip } from '@/components/ui';
import { DateTimePicker } from '@/components/ui/date-picker';
import {
  APP_TIME_ZONE,
  isoToIstanbulWallClock,
  istanbulWallClockToISO,
} from '@/lib/datetime';
import { useRouter } from '@/i18n/navigation';

type Preference = { rank: number; startsAt: string };
type Outcome = 'completed' | 'no_show' | 'cancelled';

export function AppointmentPanel({
  candidateId,
  locale,
  status,
  preferences,
  scheduledStartsAt,
  outcomeNote,
}: {
  candidateId: string;
  locale: string;
  status?: string;
  preferences: Preference[];
  scheduledStartsAt?: string;
  outcomeNote?: string;
}) {
  const t = useTranslations('admin.leads.appointment');
  const router = useRouter();
  const [pickerValue, setPickerValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  });

  async function send(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/candidates/${candidateId}/appointment`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        // 404/409 means the appointment changed under us (another tab/staff);
        // a stale panel should prompt a refresh rather than a blind retry.
        setError(
          response.status === 404 || response.status === 409
            ? t('stale')
            : t('error'),
        );
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t('error'));
      setBusy(false);
    }
  }

  const isRequested = status === 'requested';
  const isScheduled = status === 'scheduled';
  const isResolved =
    status === 'completed' || status === 'no_show' || status === 'cancelled';

  const outcomeTone =
    status === 'completed'
      ? 'emerald'
      : status === 'no_show'
        ? 'amber'
        : 'red';

  return (
    <div className="mt-6 rounded-3xl bg-[#F8F7FB] p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
        {t('title')}
      </h3>

      {/* Requested: choose a time from preferences or freely, then confirm. */}
      {isRequested && (
        <div className="mt-4 space-y-4">
          {preferences.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[#2E286C]/55">
                {t('preferencesHint')}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {preferences.map((preference) => (
                  <button
                    key={`${preference.rank}-${preference.startsAt}`}
                    type="button"
                    onClick={() =>
                      setPickerValue(isoToIstanbulWallClock(preference.startsAt))
                    }
                    className="rounded-2xl bg-white p-3 text-left ring-1 ring-black/[0.04] transition-colors hover:ring-[#533089]/30"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#533089]">
                      {t('rank', { rank: preference.rank })}
                    </div>
                    <div className="mt-1 text-sm font-bold text-[#2E286C]">
                      {formatter.format(new Date(preference.startsAt))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold text-[#2E286C]/55">
              {t('pickTime')}
            </p>
            <DateTimePicker
              locale={locale}
              min={new Date()}
              value={pickerValue}
              onChange={setPickerValue}
              placeholder={t('pickTime')}
            />
          </div>
          {error && (
            <p className="text-sm font-semibold text-red-600">{error}</p>
          )}
          <button
            type="button"
            disabled={busy || !pickerValue}
            onClick={() =>
              send({
                action: 'schedule',
                startsAt: istanbulWallClockToISO(pickerValue),
              })
            }
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#533089] px-5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-[#533089]/20 transition-colors hover:bg-[#462878] disabled:opacity-50"
          >
            <CalendarCheck className="h-4 w-4" />
            {t('confirm')}
          </button>
          <p className="text-xs text-[#2E286C]/45">{t('emailNote')}</p>
        </div>
      )}

      {/* Scheduled: show the confirmed time + record an outcome. */}
      {isScheduled && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#533089]/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#533089]">
              {t('scheduledAt')}
            </div>
            <div className="mt-1 text-lg font-bold text-[#2E286C]">
              {scheduledStartsAt
                ? formatter.format(new Date(scheduledStartsAt))
                : '—'}
            </div>
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('outcomeNotePlaceholder')}
            maxLength={2000}
            rows={2}
            className="w-full resize-none rounded-xl border border-[#2E286C]/10 bg-white px-3 py-2 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
          />
          {error && (
            <p className="text-sm font-semibold text-red-600">{error}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ['completed', 'emerald'],
                ['no_show', 'amber'],
                ['cancelled', 'red'],
              ] as const
            ).map(([outcome]) => (
              <button
                key={outcome}
                type="button"
                disabled={busy}
                onClick={() =>
                  send({ action: 'resolve', outcome, note: note.trim() || undefined })
                }
                className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-white px-3 text-xs font-bold text-[#2E286C] ring-1 ring-black/10 transition-colors hover:bg-black/[0.03] disabled:opacity-50"
              >
                {t(`outcome_${outcome as Outcome}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resolved: outcome badge + confirmed time + note. */}
      {isResolved && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              tone={outcomeTone}
              icon={
                status === 'completed' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )
              }
            >
              {t(`outcome_${status as Outcome}`)}
            </StatusChip>
            {scheduledStartsAt && (
              <span className="text-sm font-semibold text-[#2E286C]/55">
                {formatter.format(new Date(scheduledStartsAt))}
              </span>
            )}
          </div>
          {outcomeNote && (
            <p className="rounded-2xl bg-white p-3 text-sm text-[#2E286C]/75 ring-1 ring-black/[0.04]">
              {outcomeNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
