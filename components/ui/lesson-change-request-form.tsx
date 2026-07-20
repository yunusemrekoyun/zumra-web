'use client';

import { useState } from 'react';
import { CalendarClock, XCircle } from 'lucide-react';
import { istanbulWallClockToISO } from '@/lib/datetime';
import { useRouter } from '@/i18n/navigation';
import { DateTimePicker } from './date-picker';

export type LessonChangeRequestLabels = {
  requestCancel: string;
  requestPostpone: string;
  submit: string;
  newTimePlaceholder: string;
  notePlaceholder: string;
  dismiss: string;
  error: string;
  errorCutoff: string;
  errorPending: string;
};

type Mode = 'idle' | 'cancel' | 'postpone';

export function LessonChangeRequestForm({
  lessonSessionId,
  locale,
  labels,
}: {
  lessonSessionId: string;
  locale: string;
  labels: LessonChangeRequestLabels;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [note, setNote] = useState('');
  const [newTime, setNewTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setMode('idle');
    setNote('');
    setNewTime('');
    setError('');
  }

  async function submit() {
    if (busy || mode === 'idle') return;
    setBusy(true);
    setError('');
    try {
      const trimmedNote = note.trim();
      const response = await fetch(
        `/api/lessons/${lessonSessionId}/change-request`,
        {
          body: JSON.stringify({
            type: mode,
            ...(mode === 'postpone' && newTime
              ? { requestedStartsAt: istanbulWallClockToISO(newTime) }
              : {}),
            ...(trimmedNote ? { note: trimmedNote } : {}),
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (response.ok) {
        reset();
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => ({}));
      const code = String(body.error ?? '');
      setError(
        code === 'lesson_change_cutoff_passed'
          ? labels.errorCutoff
          : code === 'lesson_change_already_pending'
            ? labels.errorPending
            : labels.error,
      );
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'idle') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('postpone')}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 transition-colors duration-150 hover:bg-amber-100"
        >
          <CalendarClock className="h-4 w-4" />
          {labels.requestPostpone}
        </button>
        <button
          type="button"
          onClick={() => setMode('cancel')}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700 transition-colors duration-150 hover:bg-red-100"
        >
          <XCircle className="h-4 w-4" />
          {labels.requestCancel}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-[#FCFCFD] p-3">
      {mode === 'postpone' ? (
        <DateTimePicker
          locale={locale}
          min={new Date()}
          value={newTime}
          onChange={setNewTime}
          placeholder={labels.newTimePlaceholder}
        />
      ) : null}
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={labels.notePlaceholder}
        maxLength={1000}
        rows={2}
        className="w-full resize-none rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-3 py-2 text-xs font-medium text-[#2E286C] outline-none transition-colors placeholder:text-[#2E286C]/35 focus:border-[#533089]/30"
      />
      {error ? (
        <p className="text-xs font-semibold text-[#B42318]">{error}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-[#2E286C]/60 ring-1 ring-black/10 transition-colors hover:bg-black/[0.03] disabled:opacity-60"
        >
          {labels.dismiss}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[#533089] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#43236f] disabled:opacity-60"
        >
          {labels.submit}
        </button>
      </div>
    </div>
  );
}
