'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  X,
} from 'lucide-react';
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
type Verdict = 'negative' | 'positive' | 'thinking';

export function AppointmentPanel({
  candidateId,
  canCreate,
  followUpAt,
  locale,
  outcomeNote,
  outcomeResult,
  preferences,
  scheduledStartsAt,
  status,
}: {
  candidateId: string;
  canCreate: boolean;
  followUpAt?: string;
  locale: string;
  outcomeNote?: string;
  outcomeResult?: string;
  preferences: Preference[];
  scheduledStartsAt?: string;
  status?: string;
}) {
  const t = useTranslations('admin.leads.appointment');
  const router = useRouter();
  const [pickerValue, setPickerValue] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'verdict'>('idle');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [followUpValue, setFollowUpValue] = useState('');
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

  function resolveWithVerdict(selected: Verdict) {
    if (selected === 'negative' && !note.trim()) {
      setError(t('noteRequired'));
      return;
    }
    send({
      action: 'resolve',
      outcome: 'completed',
      outcomeResult: selected,
      note: note.trim() || undefined,
      followUpAt:
        selected === 'thinking' && followUpValue
          ? istanbulWallClockToISO(followUpValue)
          : undefined,
    });
  }

  function resolveNegativePath(outcome: Exclude<Outcome, 'completed'>) {
    if (!note.trim()) {
      setError(t('noteRequired'));
      return;
    }
    send({ action: 'resolve', outcome, note: note.trim() });
  }

  const isRequested = status === 'requested';
  const isScheduled = status === 'scheduled';
  const isResolved =
    status === 'completed' || status === 'no_show' || status === 'cancelled';
  const hasAppointment = Boolean(status);

  const outcomeTone =
    status === 'completed'
      ? outcomeResult === 'negative'
        ? 'red'
        : outcomeResult === 'thinking'
          ? 'amber'
          : 'emerald'
      : status === 'no_show'
        ? 'amber'
        : 'red';

  return (
    <div className="mt-6 rounded-3xl bg-[#F8F7FB] p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
        {t('title')}
      </h3>

      {/* No appointment yet: staff books one directly. */}
      {!hasAppointment && (
        <div className="mt-4 space-y-4">
          {canCreate ? (
            <>
              <p className="text-sm text-[#2E286C]/60">{t('planHint')}</p>
              <DateTimePicker
                locale={locale}
                min={new Date()}
                value={pickerValue}
                onChange={setPickerValue}
                placeholder={t('pickTime')}
              />
              {error && (
                <p className="text-sm font-semibold text-red-600">{error}</p>
              )}
              <button
                type="button"
                disabled={busy || !pickerValue}
                onClick={() =>
                  send({
                    action: 'create',
                    startsAt: istanbulWallClockToISO(pickerValue),
                  })
                }
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#533089] px-5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-[#533089]/20 transition-colors hover:bg-[#462878] disabled:opacity-50"
              >
                <CalendarPlus className="h-4 w-4" />
                {t('planCta')}
              </button>
              <p className="text-xs text-[#2E286C]/45">{t('emailNote')}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#2E286C]/50">{t('noneClosed')}</p>
          )}
        </div>
      )}

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

      {/* Scheduled: confirmed time + reschedule + two-step outcome flow. */}
      {isScheduled && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#533089]/10">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#533089]">
                {t('scheduledAt')}
              </div>
              <div className="mt-1 text-lg font-bold text-[#2E286C]">
                {scheduledStartsAt
                  ? formatter.format(new Date(scheduledStartsAt))
                  : '—'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'reschedule' ? 'idle' : 'reschedule');
                setError('');
                if (scheduledStartsAt) {
                  setPickerValue(isoToIstanbulWallClock(scheduledStartsAt));
                }
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#F8F7FB] px-3 text-xs font-bold text-[#533089] ring-1 ring-[#533089]/15 transition-colors hover:bg-[#533089]/10"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {t('reschedule')}
            </button>
          </div>

          {mode === 'reschedule' && (
            <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04]">
              <DateTimePicker
                locale={locale}
                min={new Date()}
                value={pickerValue}
                onChange={setPickerValue}
                placeholder={t('pickTime')}
              />
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('rescheduleReason')}
                maxLength={500}
                className="w-full rounded-xl border border-[#2E286C]/10 bg-white px-3 py-2 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
              />
              {error && (
                <p className="text-sm font-semibold text-red-600">{error}</p>
              )}
              <button
                type="button"
                disabled={busy || !pickerValue}
                onClick={() =>
                  send({
                    action: 'reschedule',
                    startsAt: istanbulWallClockToISO(pickerValue),
                    note: note.trim() || undefined,
                  })
                }
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#533089] px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#462878] disabled:opacity-50"
              >
                {t('rescheduleCta')}
              </button>
            </div>
          )}

          {mode !== 'reschedule' && (
            <>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('outcomeNotePlaceholder')}
                maxLength={2000}
                rows={2}
                className="w-full resize-none rounded-xl border border-[#2E286C]/10 bg-white px-3 py-2 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
              />

              {mode === 'verdict' ? (
                <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#533089]">
                    {t('verdictTitle')}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['positive', 'thinking', 'negative'] as const).map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setVerdict(option);
                            setError('');
                          }}
                          className={`inline-flex min-h-10 items-center justify-center rounded-2xl px-3 text-xs font-bold transition-colors ${
                            verdict === option
                              ? 'bg-[#533089] text-white'
                              : 'bg-[#F8F7FB] text-[#2E286C] ring-1 ring-black/[0.06] hover:bg-[#533089]/10'
                          }`}
                        >
                          {t(`verdict_${option}`)}
                        </button>
                      ),
                    )}
                  </div>
                  {verdict === 'thinking' && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-[#2E286C]/55">
                        {t('followUpLabel')}
                      </p>
                      <DateTimePicker
                        locale={locale}
                        min={new Date()}
                        value={followUpValue}
                        onChange={setFollowUpValue}
                        placeholder={t('followUpLabel')}
                      />
                    </div>
                  )}
                  {verdict === 'negative' && (
                    <p className="text-xs font-semibold text-[#2E286C]/55">
                      {t('negativeNoteHint')}
                    </p>
                  )}
                  {error && (
                    <p className="text-sm font-semibold text-red-600">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !verdict}
                      onClick={() => verdict && resolveWithVerdict(verdict)}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-2xl bg-[#533089] px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#462878] disabled:opacity-50"
                    >
                      {t('verdictCta')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('idle');
                        setVerdict(null);
                        setError('');
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-white px-4 text-xs font-bold text-[#2E286C] ring-1 ring-black/10"
                    >
                      {t('back')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {error && (
                    <p className="text-sm font-semibold text-red-600">{error}</p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMode('verdict');
                        setError('');
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#533089] px-3 text-xs font-bold text-white transition-colors hover:bg-[#462878] disabled:opacity-50"
                    >
                      {t('outcome_completed')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolveNegativePath('no_show')}
                      className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-white px-3 text-xs font-bold text-[#2E286C] ring-1 ring-black/10 transition-colors hover:bg-black/[0.03] disabled:opacity-50"
                    >
                      {t('outcome_no_show')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => resolveNegativePath('cancelled')}
                      className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-white px-3 text-xs font-bold text-[#2E286C] ring-1 ring-black/10 transition-colors hover:bg-black/[0.03] disabled:opacity-50"
                    >
                      {t('outcome_cancelled')}
                    </button>
                  </div>
                  <p className="text-xs text-[#2E286C]/45">{t('resolveHint')}</p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Resolved: outcome + verdict badge + confirmed time + notes. */}
      {isResolved && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              tone={outcomeTone}
              icon={
                status === 'completed' && outcomeResult !== 'negative' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )
              }
            >
              {status === 'completed' && outcomeResult
                ? t(`result_${outcomeResult as Verdict}`)
                : t(`outcome_${status as Outcome}`)}
            </StatusChip>
            {scheduledStartsAt && (
              <span className="text-sm font-semibold text-[#2E286C]/55">
                {formatter.format(new Date(scheduledStartsAt))}
              </span>
            )}
          </div>
          {followUpAt && (
            <p className="rounded-2xl bg-[#F8F0DC] p-3 text-sm font-semibold text-[#9A6A0B]">
              {t('followUpAt', {
                when: formatter.format(new Date(followUpAt)),
              })}
            </p>
          )}
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
