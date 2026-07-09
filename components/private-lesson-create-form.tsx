'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CalendarPlus, GraduationCap, Pencil } from 'lucide-react';
import { Button, FormField, Input, ModulePanel } from '@/components/ui';
import { DateTimePicker } from '@/components/ui/date-picker';
import type { SchedulablePrivateEnrollment } from '@/lib/server/services/lesson-schedules';
import { cn } from '@/lib/utils';

type Slot = { date: string; time: string };
type Conflict = { index: number; scope: 'teacher' | 'student' | 'self' };
type Mode = 'single' | 'recurring';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

// DateTimePicker emits local 'YYYY-MM-DDTHH:mm'.
function parseSlot(value: string): Slot | null {
  if (!value || value.length < 16) return null;
  return { date: value.slice(0, 10), time: value.slice(11, 16) };
}

function slotToPickerValue(slot: Slot): string {
  return `${slot.date}T${slot.time}`;
}

function addWeeks(date: string, weeks: number): string {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + weeks * 7);
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

export function PrivateLessonCreateForm({
  locale,
  enrollments,
  showTeacher,
  returnTo,
}: {
  locale: string;
  enrollments: SchedulablePrivateEnrollment[];
  showTeacher: boolean;
  returnTo: string;
}) {
  const t = useTranslations('privateLesson');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [mode, setMode] = useState<Mode>('single');
  const [startValue, setStartValue] = useState('');
  const [count, setCount] = useState(4);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  function formatSlot(slot: Slot): string {
    return dateFormatter.format(new Date(`${slot.date}T${slot.time}`));
  }

  function regenerate(start: string, repeats: number, nextMode: Mode) {
    const parsed = parseSlot(start);
    setConflicts([]);
    setEditingIndex(null);
    if (!parsed) {
      setSlots([]);
      return;
    }
    if (nextMode === 'single') {
      setSlots([parsed]);
      return;
    }
    const generated: Slot[] = [];
    for (let index = 0; index < Math.max(1, repeats); index += 1) {
      generated.push({ date: addWeeks(parsed.date, index), time: parsed.time });
    }
    setSlots(generated);
  }

  function conflictFor(index: number): Conflict | undefined {
    return conflicts.find((conflict) => conflict.index === index);
  }

  function conflictMessage(scope: Conflict['scope']): string {
    if (scope === 'teacher') return t('conflictTeacher');
    if (scope === 'student') return t('conflictStudent');
    return t('conflictSelf');
  }

  async function submit() {
    setError(undefined);
    if (!enrollmentId) {
      setError(t('errorStudent'));
      return;
    }
    if (!slots.length) {
      setError(t('errorDate'));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/lessons/private', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enrollmentId, slots }),
      });
      if (response.ok) {
        window.location.assign(returnTo);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        conflicts?: Conflict[];
      };
      if (response.status === 409 && body.conflicts?.length) {
        setConflicts(
          body.conflicts.map((conflict) => ({
            index: conflict.index,
            scope: conflict.scope,
          })),
        );
        setError(t('conflictIntro'));
      } else {
        setError(t('error'));
      }
      setBusy(false);
    } catch {
      setError(t('error'));
      setBusy(false);
    }
  }

  if (enrollments.length === 0) {
    return (
      <ModulePanel className="rounded-3xl">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <GraduationCap className="h-8 w-8 text-[#2E286C]/25" />
          <p className="text-sm font-semibold text-[#2E286C]/55">
            {t('noStudents')}
          </p>
        </div>
      </ModulePanel>
    );
  }

  return (
    <ModulePanel className="space-y-5 rounded-3xl">
      <FormField label={t('studentLabel')} required>
        <select
          value={enrollmentId}
          onChange={(event) => setEnrollmentId(event.target.value)}
          className="h-10 w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none transition-all focus:border-[#533089]/30"
        >
          <option value="">{t('studentPlaceholder')}</option>
          {enrollments.map((enrollment) => (
            <option key={enrollment.enrollmentId} value={enrollment.enrollmentId}>
              {enrollment.studentName}
              {showTeacher ? ` — ${enrollment.instructorName}` : ''}
            </option>
          ))}
        </select>
      </FormField>

      <div className="flex gap-2">
        {(['single', 'recurring'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              regenerate(startValue, count, value);
            }}
            className={cn(
              'flex-1 rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors',
              mode === value
                ? 'border-[#533089]/30 bg-[#533089]/5 text-[#533089]'
                : 'border-black/[0.06] bg-white text-[#2E286C]/45 hover:bg-black/[0.02]',
            )}
          >
            {value === 'single' ? t('modeSingle') : t('modeRecurring')}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label={mode === 'single' ? t('dateLabel') : t('startLabel')}>
          <DateTimePicker
            locale={locale}
            min={new Date()}
            value={startValue}
            onChange={(value) => {
              setStartValue(value);
              regenerate(value, count, mode);
            }}
            placeholder={t('datePlaceholder')}
          />
        </FormField>
        {mode === 'recurring' && (
          <FormField label={t('countLabel')}>
            <Input
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(event) => {
                const next = Math.min(
                  30,
                  Math.max(1, Number(event.target.value) || 1),
                );
                setCount(next);
                regenerate(startValue, next, mode);
              }}
            />
          </FormField>
        )}
      </div>

      {slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
            {t('slotsTitle', { count: slots.length })}
          </p>
          <ul className="space-y-2">
            {slots.map((slot, index) => {
              const conflict = conflictFor(index);
              const editing = editingIndex === index;
              return (
                <li
                  key={index}
                  className={cn(
                    'rounded-2xl border px-4 py-3',
                    conflict
                      ? 'border-red-500/30 bg-red-50/60'
                      : 'border-black/[0.05] bg-white',
                  )}
                >
                  {editing ? (
                    <DateTimePicker
                      locale={locale}
                      min={new Date()}
                      value={slotToPickerValue(slot)}
                      onChange={(value) => {
                        const parsed = parseSlot(value);
                        if (!parsed) return;
                        setSlots((prev) =>
                          prev.map((item, i) => (i === index ? parsed : item)),
                        );
                        setConflicts((prev) =>
                          prev.filter((item) => item.index !== index),
                        );
                        setEditingIndex(null);
                      }}
                      placeholder={t('datePlaceholder')}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-[#2E286C]">
                          {formatSlot(slot)}
                        </span>
                        {conflict && (
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5 flex-none" />
                            {conflictMessage(conflict.scope)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(index)}
                        className="inline-flex flex-none items-center gap-1.5 rounded-xl bg-[#533089]/8 px-3 py-1.5 text-xs font-bold text-[#533089] transition-colors hover:bg-[#533089]/15"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('change')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <p
          className={cn(
            'text-sm font-semibold',
            conflicts.length ? 'text-red-600' : 'text-[#B42318]',
          )}
        >
          {error}
        </p>
      )}

      <Button
        onClick={submit}
        disabled={busy || !enrollmentId || slots.length === 0}
      >
        <CalendarPlus className="h-4 w-4" />
        {busy ? t('creating') : t('create')}
      </Button>
    </ModulePanel>
  );
}
