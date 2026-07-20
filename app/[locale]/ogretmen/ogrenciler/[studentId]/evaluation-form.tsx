'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui';

export type EvaluationFormLabels = {
  placeholder: string;
  save: string;
  saving: string;
  success: string;
  error: string;
  hint: string;
};

export function EvaluationForm({
  initialNote,
  labels,
  studentProfileId,
}: {
  initialNote: string | null;
  labels: EvaluationFormLabels;
  studentProfileId: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(
        `/api/teacher/students/${studentProfileId}/evaluation`,
        {
          body: JSON.stringify({ note }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('save_failed');
      setMessage({ text: labels.success, type: 'success' });
      router.refresh();
    } catch {
      setMessage({ text: labels.error, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={labels.placeholder}
        maxLength={2000}
        rows={5}
        disabled={busy}
        className="w-full resize-y rounded-2xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 py-3 text-sm font-medium leading-6 text-[#2E286C] outline-none transition-colors placeholder:text-[#2E286C]/35 focus:border-[#533089]/30"
      />
      <p className="text-xs font-semibold text-[#2E286C]/45">{labels.hint}</p>
      {message && (
        <p
          className={
            message.type === 'success'
              ? 'text-sm font-semibold text-[#0B7F58]'
              : 'text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </p>
      )}
      <Button disabled={busy} onClick={() => void save()}>
        <Save className="h-4 w-4" />
        {busy ? labels.saving : labels.save}
      </Button>
    </div>
  );
}
