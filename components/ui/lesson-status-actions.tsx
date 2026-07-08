'use client';

import { useState } from 'react';
import { CalendarClock, XCircle } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { DateTimePicker } from './date-picker';

export type LessonStatusActionLabels = {
  cancel: string;
  cancelSubmit: string;
  postpone: string;
  postponeSubmit: string;
  newTimePlaceholder: string;
  notePlaceholder: string;
  dismiss: string;
  error: string;
};

type Mode = 'idle' | 'cancel' | 'postpone';

export function LessonStatusActions({
  lessonSessionId,
  locale,
  labels,
}: {
  lessonSessionId: string;
  locale: string;
  labels: LessonStatusActionLabels;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [note, setNote] = useState('');
  const [newTime, setNewTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function reset() {
    setMode('idle');
    setNote('');
    setNewTime('');
    setFailed(false);
  }

  async function submit(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/lessons/${lessonSessionId}/status`, {
        body: JSON.stringify(body),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        reset();
        router.refresh();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const trimmedNote = note.trim();

  if (mode === 'idle') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('postpone')}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 transition-colors duration-150 hover:bg-amber-100"
        >
          <CalendarClock className="h-4 w-4" />
          {labels.postpone}
        </button>
        <button
          type="button"
          onClick={() => setMode('cancel')}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700 transition-colors duration-150 hover:bg-red-100"
        >
          <XCircle className="h-4 w-4" />
          {labels.cancel}
        </button>
      </div>
    );
  }

  const noteField = (
    <textarea
      value={note}
      onChange={(event) => setNote(event.target.value)}
      placeholder={labels.notePlaceholder}
      maxLength={1000}
      rows={2}
      className="w-full resize-none rounded-xl border border-[#2E286C]/10 bg-[#F8F9FC] px-3 py-2 text-xs font-medium text-[#2E286C] outline-none transition-colors placeholder:text-[#2E286C]/35 focus:border-[#533089]/30"
    />
  );

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
      {noteField}
      {failed ? (
        <p className="text-xs font-semibold text-[#B42318]">{labels.error}</p>
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
        {mode === 'cancel' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              submit({
                status: 'cancelled',
                ...(trimmedNote ? { note: trimmedNote } : {}),
              })
            }
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[#B42318] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#912018] disabled:opacity-60"
          >
            {labels.cancelSubmit}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !newTime}
            onClick={() =>
              submit({
                status: 'postponed',
                startsAt: new Date(newTime).toISOString(),
                ...(trimmedNote ? { note: trimmedNote } : {}),
              })
            }
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {labels.postponeSubmit}
          </button>
        )}
      </div>
    </div>
  );
}
