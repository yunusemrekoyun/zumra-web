'use client';

import { useState } from 'react';
import { CalendarClock, Check, Inbox, X, XCircle } from 'lucide-react';
import { isoToIstanbulWallClock, istanbulWallClockToISO } from '@/lib/datetime';
import { useRouter } from '@/i18n/navigation';
import { DateTimePicker, ModulePanel } from '@/components/ui';
import type { TeacherChangeRequestView } from '@/lib/server/services/lesson-change-requests';

export type ChangeRequestsPanelLabels = {
  approve: string;
  badge: string;
  empty: string;
  error: string;
  errorConflict: string;
  errorTimeRequired: string;
  newTimePlaceholder: string;
  notePlaceholder: string;
  reject: string;
  requestedTime: (time: string) => string;
  studentNote: (note: string) => string;
  title: string;
  typeCancel: string;
  typePostpone: string;
};

function formatLessonTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));
}

export function ChangeRequestsPanel({
  labels,
  locale,
  requests,
}: {
  labels: ChangeRequestsPanelLabels;
  locale: string;
  requests: TeacherChangeRequestView[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [times, setTimes] = useState<Record<string, string>>({});

  if (!requests.length) return null;

  async function decide(
    request: TeacherChangeRequestView,
    action: 'approve' | 'reject',
  ) {
    if (busyId) return;
    setBusyId(request.id);
    setErrors((prev) => ({ ...prev, [request.id]: '' }));
    try {
      const note = (notes[request.id] ?? '').trim();
      const time =
        times[request.id] ??
        (request.requestedStartsAt
          ? isoToIstanbulWallClock(request.requestedStartsAt)
          : '');
      const response = await fetch(
        `/api/lessons/change-requests/${request.id}`,
        {
          body: JSON.stringify({
            action,
            ...(note ? { note } : {}),
            ...(action === 'approve' && request.type === 'postpone' && time
              ? { startsAt: istanbulWallClockToISO(time) }
              : {}),
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (response.ok) {
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => ({}));
      const code = String(body.error ?? '');
      // Already decided elsewhere (another tab, or the lesson was closed
      // directly) — the card is stale, so reload instead of erroring on it.
      if (code === 'lesson_change_request_not_open') {
        router.refresh();
        return;
      }
      setErrors((prev) => ({
        ...prev,
        [request.id]:
          code === 'lesson_postpone_conflict'
            ? labels.errorConflict
            : code === 'lesson_change_time_required' ||
                code === 'lesson_postpone_invalid'
              ? labels.errorTimeRequired
              : labels.error,
      }));
    } catch {
      setErrors((prev) => ({ ...prev, [request.id]: labels.error }));
    } finally {
      setBusyId('');
    }
  }

  return (
    <ModulePanel>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
        <Inbox className="h-4 w-4" />
        {labels.badge}
      </div>
      <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
        {labels.title}
      </h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {requests.map((request) => {
          const busy = busyId === request.id;
          const error = errors[request.id];
          return (
            <div
              key={request.id}
              className="space-y-3 rounded-2xl border border-black/[0.06] bg-[#FCFCFD] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#2E286C]">
                  {request.studentName}
                </p>
                <span
                  className={
                    request.type === 'cancel'
                      ? 'inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-700'
                      : 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700'
                  }
                >
                  {request.type === 'cancel' ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5" />
                  )}
                  {request.type === 'cancel'
                    ? labels.typeCancel
                    : labels.typePostpone}
                </span>
              </div>

              <p className="text-xs font-semibold text-[#2E286C]/65">
                {request.lessonTitle} —{' '}
                {formatLessonTime(request.lessonStartsAt, locale)}
              </p>
              {request.requestedStartsAt ? (
                <p className="text-xs font-semibold text-[#2E286C]/65">
                  {labels.requestedTime(
                    formatLessonTime(request.requestedStartsAt, locale),
                  )}
                </p>
              ) : null}
              {request.note ? (
                <p className="rounded-xl bg-[#F8F9FC] px-3 py-2 text-xs font-medium text-[#2E286C]/75">
                  {labels.studentNote(request.note)}
                </p>
              ) : null}

              {request.type === 'postpone' ? (
                <DateTimePicker
                  locale={locale}
                  min={new Date()}
                  value={
                    times[request.id] ??
                    (request.requestedStartsAt
                      ? isoToIstanbulWallClock(request.requestedStartsAt)
                      : '')
                  }
                  onChange={(value) =>
                    setTimes((prev) => ({ ...prev, [request.id]: value }))
                  }
                  placeholder={labels.newTimePlaceholder}
                />
              ) : null}

              <textarea
                value={notes[request.id] ?? ''}
                onChange={(event) =>
                  setNotes((prev) => ({
                    ...prev,
                    [request.id]: event.target.value,
                  }))
                }
                placeholder={labels.notePlaceholder}
                maxLength={1000}
                rows={2}
                className="w-full resize-none rounded-xl border border-[#2E286C]/10 bg-white px-3 py-2 text-xs font-medium text-[#2E286C] outline-none transition-colors placeholder:text-[#2E286C]/35 focus:border-[#533089]/30"
              />

              {error ? (
                <p className="text-xs font-semibold text-[#B42318]">{error}</p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide(request, 'reject')}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-[#B42318] ring-1 ring-[#B42318]/25 transition-colors hover:bg-[#B42318]/5 disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  {labels.reject}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide(request, 'approve')}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#533089] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#43236f] disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {labels.approve}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ModulePanel>
  );
}
