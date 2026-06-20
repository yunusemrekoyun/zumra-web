'use client';

import { useState } from 'react';
import { CircleStop } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

export function EndLessonButton({
  confirmText,
  label,
  lessonSessionId,
}: {
  confirmText: string;
  label: string;
  lessonSessionId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function endLesson() {
    if (busy) return;
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/lessons/${lessonSessionId}/status`, {
        body: JSON.stringify({ status: 'completed' }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={endLesson}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#B42318] px-4 py-3 text-xs font-bold text-white shadow-sm transition-colors duration-150 hover:bg-[#912018] disabled:opacity-60"
    >
      <CircleStop className="h-4 w-4" />
      {label}
    </button>
  );
}
