'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarClock,
  Check,
  ClipboardList,
  Hand,
  Plus,
  UserRound,
} from 'lucide-react';
import { EmptyState, ModulePanel } from '@/components/ui';
import { DateTimePicker } from '@/components/ui/date-picker';
import { APP_TIME_ZONE, istanbulWallClockToISO } from '@/lib/datetime';
import { Link, useRouter } from '@/i18n/navigation';
import type { AdvisorTaskBoard, AdvisorTaskRow } from '@/lib/server/services/advisor-tasks';

export function TasksClient({
  board,
  locale,
}: {
  board: AdvisorTaskBoard;
  locale: string;
}) {
  const t = useTranslations('advisor.tasks');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Keeps the board disabled until the refreshed data lands; releasing the
  // buttons on the stale board lets a second click hit the already-claimed
  // task and show a misleading "task taken" error.
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState('');
  const acting = busyId !== null || refreshing;

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  });

  async function act(taskId: string, action: 'claim' | 'complete') {
    if (acting) return;
    setBusyId(taskId);
    setError('');
    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        body: JSON.stringify({ action }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      });
      if (!response.ok) {
        setError(response.status === 409 ? t('taken') : t('error'));
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setError(t('error'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        {error && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <ModulePanel className="rounded-3xl">
          <PanelTitle label={t('poolTitle')} count={board.pool.length} />
          {board.pool.length ? (
            <ul className="mt-4 space-y-3">
              {board.pool.map((task) => (
                <TaskRow
                  key={task.id}
                  action={
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => act(task.id, 'claim')}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#533089] px-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#462878] disabled:opacity-50"
                    >
                      <Hand className="h-3.5 w-3.5" />
                      {t('claim')}
                    </button>
                  }
                  formatter={formatter}
                  t={t}
                  task={task}
                />
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-4 min-h-[8rem]" title={t('poolEmpty')} description="" />
          )}
        </ModulePanel>

        <ModulePanel className="rounded-3xl">
          <PanelTitle label={t('mineTitle')} count={board.mine.length} />
          {board.mine.length ? (
            <ul className="mt-4 space-y-3">
              {board.mine.map((task) => (
                <TaskRow
                  key={task.id}
                  action={
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => act(task.id, 'complete')}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#1E7F5C] ring-1 ring-[#1E7F5C]/25 transition-colors hover:bg-[#1E7F5C]/10 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t('complete')}
                    </button>
                  }
                  formatter={formatter}
                  t={t}
                  task={task}
                />
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-4 min-h-[8rem]" title={t('mineEmpty')} description="" />
          )}
        </ModulePanel>

        <ModulePanel className="rounded-3xl">
          <PanelTitle label={t('doneTitle')} count={board.doneToday.length} />
          {board.doneToday.length ? (
            <ul className="mt-4 space-y-2">
              {board.doneToday.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2 rounded-2xl bg-[#F8F7FB] px-4 py-2.5 text-sm text-[#2E286C]/50"
                >
                  <Check className="h-4 w-4 flex-none text-[#1E7F5C]" />
                  <span className="truncate line-through">
                    {taskLabel(task, t)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="mt-4 min-h-[6rem]" title={t('doneEmpty')} description="" />
          )}
        </ModulePanel>
      </div>

      <NewTaskForm locale={locale} onCreated={() => router.refresh()} />
    </div>
  );
}

/** Compact board slice for the dashboard: claimable pool or today's work. */
export function TaskQuickPanel({
  emptyLabel,
  locale,
  mode,
  rows,
  title,
}: {
  emptyLabel: string;
  locale: string;
  mode: 'mine' | 'pool';
  rows: AdvisorTaskRow[];
  title: string;
}) {
  const t = useTranslations('advisor.tasks');
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Same guard as TasksClient: stay disabled until the refresh lands.
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState('');
  const acting = busyId !== null || refreshing;

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  });

  async function act(taskId: string, action: 'claim' | 'complete') {
    if (acting) return;
    setBusyId(taskId);
    setError('');
    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        body: JSON.stringify({ action }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      });
      if (!response.ok) {
        setError(response.status === 409 ? t('taken') : t('error'));
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setError(t('error'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModulePanel className="rounded-3xl">
      <div className="flex items-center justify-between gap-3">
        <PanelTitle label={title} count={rows.length} />
        <Link
          href="/danisman/gorevlerim"
          className="text-xs font-bold uppercase tracking-wider text-[#533089] hover:text-[#462878]"
        >
          {t('seeAll')}
        </Link>
      </div>
      {error && (
        <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
      )}
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.slice(0, 4).map((task) => (
            <TaskRow
              key={task.id}
              action={
                mode === 'pool' ? (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => act(task.id, 'claim')}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#533089] px-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#462878] disabled:opacity-50"
                  >
                    <Hand className="h-3.5 w-3.5" />
                    {t('claim')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => act(task.id, 'complete')}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#1E7F5C] ring-1 ring-[#1E7F5C]/25 transition-colors hover:bg-[#1E7F5C]/10 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('complete')}
                  </button>
                )
              }
              formatter={formatter}
              t={t}
              task={task}
            />
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-4 min-h-[8rem]" title={emptyLabel} description="" />
      )}
    </ModulePanel>
  );
}

function PanelTitle({ count, label }: { count: number; label: string }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
      {label}
      <span className="rounded-lg bg-[#533089]/10 px-2 py-0.5 text-[11px] font-bold tracking-normal text-[#533089]">
        {count}
      </span>
    </h3>
  );
}

function taskLabel(
  task: AdvisorTaskRow,
  t: ReturnType<typeof useTranslations>,
) {
  return task.kind === 'manual'
    ? (task.title ?? '')
    : t(`kind_${task.kind}`);
}

function TaskRow({
  action,
  formatter,
  t,
  task,
}: {
  action: React.ReactNode;
  formatter: Intl.DateTimeFormat;
  t: ReturnType<typeof useTranslations>;
  task: AdvisorTaskRow;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#F8F7FB] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[#2E286C]">
            {taskLabel(task, t)}
          </span>
          {task.overdue && (
            <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
              {t('overdue')}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#2E286C]/55">
          {task.candidateName && (
            <Link
              href="/danisman/leadler"
              className="inline-flex items-center gap-1 font-bold text-[#533089] hover:text-[#462878]"
            >
              <UserRound className="h-3 w-3" />
              {task.candidateName}
            </Link>
          )}
          {task.dueAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {formatter.format(new Date(task.dueAt))}
            </span>
          )}
          {task.note && <span className="truncate">{task.note}</span>}
        </div>
      </div>
      {action}
    </li>
  );
}

function NewTaskForm({
  locale,
  onCreated,
}: {
  locale: string;
  onCreated: () => void;
}) {
  const t = useTranslations('advisor.tasks');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dueValue, setDueValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/admin/tasks', {
        body: JSON.stringify({
          title: title.trim(),
          note: note.trim() || undefined,
          dueAt: dueValue ? istanbulWallClockToISO(dueValue) : undefined,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('task_create_failed');
      setTitle('');
      setNote('');
      setDueValue('');
      onCreated();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModulePanel className="h-fit rounded-3xl">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
        <ClipboardList className="h-4 w-4" />
        {t('newTitle')}
      </h3>
      <p className="mt-2 text-xs text-[#2E286C]/50">{t('newHint')}</p>
      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('titlePlaceholder')}
          maxLength={200}
          className="w-full rounded-xl border border-[#2E286C]/10 bg-white px-3 py-2 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
        />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('notePlaceholder')}
          maxLength={1000}
          rows={3}
          className="w-full resize-none rounded-xl border border-[#2E286C]/10 bg-white px-3 py-2 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
        />
        <DateTimePicker
          locale={locale}
          min={new Date()}
          value={dueValue}
          onChange={setDueValue}
          placeholder={t('duePlaceholder')}
        />
        {error && (
          <p className="text-sm font-semibold text-red-600">{t('error')}</p>
        )}
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={submit}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#533089] px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#462878] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t('createCta')}
        </button>
        <p className="text-[11px] text-[#2E286C]/40">{t('privacyNote')}</p>
      </div>
    </ModulePanel>
  );
}
