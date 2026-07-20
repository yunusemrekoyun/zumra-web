'use client';

import { useState } from 'react';
import { CalendarPlus, Check, Wallet, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button, DateTimePicker, ModulePanel, StatusChip } from '@/components/ui';
import { centsToInput, formatCents, parseTlToCents } from '@/lib/domain/money';
import type {
  DiscoveryFeeView,
  DiscoveryLessonView,
  DiscoverySchedulingOptions,
} from '@/lib/server/services/discovery';

export type DiscoveryLabels = {
  scheduleTitle: string;
  candidate: string;
  instructor: string;
  branch: string;
  branchNone: string;
  time: string;
  duration: string;
  note: string;
  createAccount: string;
  createAccountHint: string;
  username: string;
  submit: string;
  submitting: string;
  scheduleSuccess: string;
  scheduleError: string;
  errorAccountExists: string;
  errorInvitationPending: string;
  errorEmailTaken: string;
  errorUsernameTaken: string;
  listTitle: string;
  listEmpty: string;
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
  accounts: { none: string; invited: string; active: string };
  markCompleted: string;
  markNoShow: string;
  markCancelled: string;
  markPaymentReceived: string;
  actionError: string;
  feesTitle: string;
  feesDescription: string;
  feeScopeBranch: string;
  feeScopeInstructor: string;
  feeAmount: string;
  feeFreeHint: string;
  feeSave: string;
  feeSaved: string;
  feeError: string;
  feeListEmpty: string;
  feeFree: string;
};

const STATUS_TONES = {
  cancelled: 'red',
  completed: 'emerald',
  no_show: 'amber',
  scheduled: 'purple',
} as const;

const PAYMENT_TONES = {
  awaiting: 'amber',
  free: 'gray',
  received: 'emerald',
  reported: 'blue',
} as const;

function formatWhen(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));
}

export function DiscoveryClient({
  canManageFees,
  fees,
  labels,
  lessons,
  locale,
  options,
}: {
  canManageFees: boolean;
  fees: DiscoveryFeeView[];
  labels: DiscoveryLabels;
  lessons: DiscoveryLessonView[];
  locale: string;
  options: DiscoverySchedulingOptions;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <ScheduleForm labels={labels} locale={locale} options={options} />
      <LessonList labels={labels} lessons={lessons} locale={locale} />
      {canManageFees ? (
        <FeeSettings
          fees={fees}
          labels={labels}
          options={options}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function ScheduleForm({
  labels,
  locale,
  options,
}: {
  labels: DiscoveryLabels;
  locale: string;
  options: DiscoverySchedulingOptions;
}) {
  const router = useRouter();
  const [candidateId, setCandidateId] = useState('');
  const [instructorProfileId, setInstructorProfileId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [time, setTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [note, setNote] = useState('');
  const [withAccount, setWithAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  async function submit() {
    if (busy || !candidateId || !instructorProfileId || !time) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const { istanbulWallClockToISO } = await import('@/lib/datetime');
      const response = await fetch('/api/discovery/lessons', {
        body: JSON.stringify({
          branchId: branchId || null,
          candidateId,
          createAccount:
            withAccount && username.trim()
              ? { username: username.trim() }
              : null,
          durationMinutes: Number(durationMinutes) || 30,
          instructorProfileId,
          locale: locale === 'en' ? 'en' : 'tr',
          note: note.trim() || null,
          scheduledAt: istanbulWallClockToISO(time),
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        setCandidateId('');
        setBranchId('');
        setTime('');
        setNote('');
        setWithAccount(false);
        setUsername('');
        setMessage({ text: labels.scheduleSuccess, type: 'success' });
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => ({}));
      const code = String(body.error ?? '');
      setMessage({
        text:
          code === 'account_already_exists'
            ? labels.errorAccountExists
            : code === 'invitation_already_pending'
              ? labels.errorInvitationPending
              : code === 'invitation_email_already_registered'
                ? labels.errorEmailTaken
                : code === 'invitation_username_taken'
                  ? labels.errorUsernameTaken
                  : labels.scheduleError,
        type: 'error',
      });
    } catch {
      setMessage({ text: labels.scheduleError, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const selectClass =
    'h-11 w-full rounded-2xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 text-sm font-semibold text-[#2E286C] outline-none transition-colors focus:border-[#533089]/30';
  const labelClass =
    'grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55';

  return (
    <ModulePanel>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#533089]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#533089]">
        <CalendarPlus className="h-4 w-4" />
        {labels.scheduleTitle}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className={labelClass}>
          {labels.candidate}
          <select
            className={selectClass}
            disabled={busy}
            onChange={(event) => setCandidateId(event.target.value)}
            value={candidateId}
          >
            <option value="">—</option>
            {options.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {labels.instructor}
          <select
            className={selectClass}
            disabled={busy}
            onChange={(event) => setInstructorProfileId(event.target.value)}
            value={instructorProfileId}
          >
            <option value="">—</option>
            {options.instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {labels.branch}
          <select
            className={selectClass}
            disabled={busy}
            onChange={(event) => setBranchId(event.target.value)}
            value={branchId}
          >
            <option value="">{labels.branchNone}</option>
            {options.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {labels.time}
          <DateTimePicker
            locale={locale}
            min={new Date()}
            onChange={setTime}
            placeholder={labels.time}
            value={time}
          />
        </label>
        <label className={labelClass}>
          {labels.duration}
          <select
            className={selectClass}
            disabled={busy}
            onChange={(event) => setDurationMinutes(event.target.value)}
            value={durationMinutes}
          >
            {['15', '30', '45', '60'].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} dk
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {labels.note}
          <input
            className={selectClass}
            disabled={busy}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </label>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl bg-[#F8F9FC] p-4">
        <label className="flex items-center gap-3 text-sm font-bold text-[#2E286C]">
          <input
            checked={withAccount}
            className="h-4 w-4 accent-[#533089]"
            disabled={busy}
            onChange={(event) => setWithAccount(event.target.checked)}
            type="checkbox"
          />
          {labels.createAccount}
        </label>
        <p className="text-xs font-semibold text-[#2E286C]/45">
          {labels.createAccountHint}
        </p>
        {withAccount ? (
          <label className={labelClass}>
            {labels.username}
            <input
              className="h-11 w-full rounded-2xl border border-[#2E286C]/10 bg-white px-4 text-sm font-semibold text-[#2E286C] outline-none transition-colors focus:border-[#533089]/30"
              disabled={busy}
              maxLength={40}
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </label>
        ) : null}
      </div>

      {message && (
        <p
          className={
            message.type === 'success'
              ? 'mt-4 text-sm font-semibold text-[#0B7F58]'
              : 'mt-4 text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </p>
      )}

      <Button
        className="mt-4"
        disabled={busy || !candidateId || !instructorProfileId || !time}
        onClick={() => void submit()}
      >
        <CalendarPlus className="h-4 w-4" />
        {busy ? labels.submitting : labels.submit}
      </Button>
    </ModulePanel>
  );
}

function LessonList({
  labels,
  lessons,
  locale,
}: {
  labels: DiscoveryLabels;
  lessons: DiscoveryLessonView[];
  locale: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState('');
  const [errorId, setErrorId] = useState('');

  async function act(
    lessonId: string,
    body: { paymentStatus?: 'received'; status?: string },
  ) {
    if (busyId) return;
    setBusyId(lessonId);
    setErrorId('');
    try {
      const response = await fetch(`/api/discovery/lessons/${lessonId}`, {
        body: JSON.stringify(body),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('failed');
      router.refresh();
    } catch {
      setErrorId(lessonId);
    } finally {
      setBusyId('');
    }
  }

  return (
    <ModulePanel>
      <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
        {labels.listTitle}
      </h2>
      {lessons.length ? (
        <div className="mt-5 space-y-3">
          {lessons.map((lesson) => {
            const busy = busyId === lesson.id;
            const open = lesson.status === 'scheduled';
            return (
              <div
                key={lesson.id}
                className="rounded-2xl border border-black/[0.06] bg-[#FCFCFD] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#2E286C]">
                      {lesson.candidateName}
                      <span className="font-semibold text-[#2E286C]/45">
                        {' '}
                        — {lesson.instructorName}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#2E286C]/45">
                      {formatWhen(lesson.scheduledAt, locale)}
                      {lesson.note ? ` · ${lesson.note}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={STATUS_TONES[lesson.status]}>
                      {labels.statuses[lesson.status]}
                    </StatusChip>
                    <StatusChip tone={PAYMENT_TONES[lesson.paymentStatus]}>
                      {lesson.feeCents > 0
                        ? `${labels.payments[lesson.paymentStatus]} · ${formatCents(lesson.feeCents)}`
                        : labels.payments.free}
                    </StatusChip>
                    <span className="rounded-full bg-[#F8F9FC] px-3 py-1 text-[11px] font-bold text-[#2E286C]/55">
                      {labels.accounts[lesson.demoAccount]}
                    </span>
                  </div>
                </div>

                {(open ||
                  (lesson.feeCents > 0 &&
                    lesson.paymentStatus !== 'received')) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {open && (
                      <>
                        <ActionButton
                          busy={busy}
                          icon={<Check className="h-3.5 w-3.5" />}
                          label={labels.markCompleted}
                          onClick={() =>
                            void act(lesson.id, { status: 'completed' })
                          }
                          tone="emerald"
                        />
                        <ActionButton
                          busy={busy}
                          icon={<X className="h-3.5 w-3.5" />}
                          label={labels.markNoShow}
                          onClick={() =>
                            void act(lesson.id, { status: 'no_show' })
                          }
                          tone="amber"
                        />
                        <ActionButton
                          busy={busy}
                          icon={<X className="h-3.5 w-3.5" />}
                          label={labels.markCancelled}
                          onClick={() =>
                            void act(lesson.id, { status: 'cancelled' })
                          }
                          tone="red"
                        />
                      </>
                    )}
                    {lesson.feeCents > 0 &&
                      lesson.paymentStatus !== 'received' && (
                        <ActionButton
                          busy={busy}
                          icon={<Wallet className="h-3.5 w-3.5" />}
                          label={labels.markPaymentReceived}
                          onClick={() =>
                            void act(lesson.id, { paymentStatus: 'received' })
                          }
                          tone="brand"
                        />
                      )}
                  </div>
                )}
                {errorId === lesson.id && (
                  <p className="mt-2 text-xs font-semibold text-[#B42318]">
                    {labels.actionError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#2E286C]/45">
          {labels.listEmpty}
        </p>
      )}
    </ModulePanel>
  );
}

function ActionButton({
  busy,
  icon,
  label,
  onClick,
  tone,
}: {
  busy: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: 'emerald' | 'amber' | 'red' | 'brand';
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    brand: 'bg-[#533089] text-white hover:bg-[#43236f]',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    red: 'bg-red-50 text-red-700 hover:bg-red-100',
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${tones[tone]}`}
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function FeeSettings({
  fees,
  labels,
  onSaved,
  options,
}: {
  fees: DiscoveryFeeView[];
  labels: DiscoveryLabels;
  onSaved: () => void;
  options: DiscoverySchedulingOptions;
}) {
  const [scope, setScope] = useState<'branch' | 'instructor'>('branch');
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  const targets = scope === 'branch' ? options.branches : options.instructors;

  async function save() {
    if (busy || !targetId) return;
    const feeCents = parseTlToCents(amount);
    if (feeCents == null || feeCents < 0) {
      setMessage({ text: labels.feeError, type: 'error' });
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/discovery/fees', {
        body: JSON.stringify({
          branchId: scope === 'branch' ? targetId : null,
          feeCents,
          instructorProfileId: scope === 'instructor' ? targetId : null,
          scope,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('failed');
      setMessage({ text: labels.feeSaved, type: 'success' });
      onSaved();
    } catch {
      setMessage({ text: labels.feeError, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const selectClass =
    'h-11 rounded-2xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 text-sm font-semibold text-[#2E286C] outline-none transition-colors focus:border-[#533089]/30';

  return (
    <ModulePanel>
      <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
        {labels.feesTitle}
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#2E286C]/65">
        {labels.feesDescription}
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <select
          className={selectClass}
          disabled={busy}
          onChange={(event) => {
            setScope(event.target.value as 'branch' | 'instructor');
            setTargetId('');
          }}
          value={scope}
        >
          <option value="branch">{labels.feeScopeBranch}</option>
          <option value="instructor">{labels.feeScopeInstructor}</option>
        </select>
        <select
          className={`${selectClass} min-w-48`}
          disabled={busy}
          onChange={(event) => {
            setTargetId(event.target.value);
            const existing = fees.find(
              (fee) =>
                fee.scope === scope && fee.targetId === event.target.value,
            );
            setAmount(existing ? centsToInput(existing.feeCents) : '0');
          }}
          value={targetId}
        >
          <option value="">—</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
        </select>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {labels.feeAmount}
          <input
            className={`${selectClass} w-36 bg-white`}
            disabled={busy}
            onChange={(event) => setAmount(event.target.value)}
            value={amount}
          />
        </label>
        <Button disabled={busy || !targetId} onClick={() => void save()}>
          {labels.feeSave}
        </Button>
      </div>
      <p className="mt-2 text-xs font-semibold text-[#2E286C]/45">
        {labels.feeFreeHint}
      </p>

      {message && (
        <p
          className={
            message.type === 'success'
              ? 'mt-3 text-sm font-semibold text-[#0B7F58]'
              : 'mt-3 text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {fees.length ? (
          fees.map((fee) => (
            <span
              key={fee.id}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 py-2 text-xs font-bold text-[#2E286C]/70"
            >
              {fee.targetName}
              <span className="text-[#533089]">
                {fee.feeCents > 0 ? formatCents(fee.feeCents) : labels.feeFree}
              </span>
            </span>
          ))
        ) : (
          <span className="text-sm font-medium text-[#2E286C]/45">
            {labels.feeListEmpty}
          </span>
        )}
      </div>
    </ModulePanel>
  );
}
