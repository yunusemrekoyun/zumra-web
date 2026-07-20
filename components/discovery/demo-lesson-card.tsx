'use client';

import { useState } from 'react';
import { Sparkles, Wallet } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Card, SectionHeader, StatusChip } from '@/components/ui';
import { formatCents } from '@/lib/domain/money';
import type { MyDiscoveryLessonView } from '@/lib/server/services/discovery';

export type DemoLessonCardLabels = {
  title: string;
  statuses: {
    scheduled: string;
    completed: string;
    cancelled: string;
    no_show: string;
  };
  payments: {
    free: string;
    awaiting: string;
    reported: string;
    received: string;
  };
  payTo: string;
  reportPayment: string;
  reporting: string;
  reportError: string;
  teacherLabel: string;
};

const STATUS_TONES = {
  cancelled: 'red',
  completed: 'emerald',
  no_show: 'amber',
  scheduled: 'purple',
} as const;

function formatWhen(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));
}

export function DemoLessonCard({
  labels,
  lessons,
  locale,
}: {
  labels: DemoLessonCardLabels;
  lessons: MyDiscoveryLessonView[];
  locale: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState('');
  const [errorId, setErrorId] = useState('');

  if (!lessons.length) return null;

  async function report(lessonId: string) {
    if (busyId) return;
    setBusyId(lessonId);
    setErrorId('');
    try {
      const response = await fetch(
        `/api/discovery/lessons/${lessonId}/report-payment`,
        {
          body: '{}',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('failed');
      router.refresh();
    } catch {
      setErrorId(lessonId);
    } finally {
      setBusyId('');
    }
  }

  return (
    <Card padded className="border-l-4 border-l-amber-400">
      <SectionHeader title={labels.title} />
      <div className="space-y-3">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="rounded-2xl bg-[#F8F9FC] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-bold text-[#2E286C]">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  {labels.teacherLabel}: {lesson.instructorName}
                </div>
                <div className="mt-1 text-xs font-semibold text-[#2E286C]/55">
                  {formatWhen(lesson.scheduledAt, locale)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={STATUS_TONES[lesson.status]}>
                  {labels.statuses[lesson.status]}
                </StatusChip>
                {lesson.feeCents > 0 && (
                  <StatusChip
                    tone={
                      lesson.paymentStatus === 'received' ? 'emerald' : 'amber'
                    }
                  >
                    {labels.payments[lesson.paymentStatus]} ·{' '}
                    {formatCents(lesson.feeCents)}
                  </StatusChip>
                )}
              </div>
            </div>

            {lesson.iban && (
              <div className="mt-3 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#2E286C]/70">
                {labels.payTo}
                {lesson.ibanHolder ? ` — ${lesson.ibanHolder}` : ''}
                <div className="mt-1 font-mono text-sm font-bold tracking-wide text-[#2E286C]">
                  {lesson.iban}
                </div>
              </div>
            )}

            {lesson.canReportPayment && (
              <button
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#533089] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#43236f] disabled:opacity-60"
                disabled={busyId === lesson.id}
                onClick={() => void report(lesson.id)}
                type="button"
              >
                <Wallet className="h-4 w-4" />
                {busyId === lesson.id ? labels.reporting : labels.reportPayment}
              </button>
            )}
            {errorId === lesson.id && (
              <p className="mt-2 text-xs font-semibold text-[#B42318]">
                {labels.reportError}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
