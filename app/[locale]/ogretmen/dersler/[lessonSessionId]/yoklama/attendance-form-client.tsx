'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardCheck, UserX } from 'lucide-react';
import { Avatar, Button, InfoField, ModulePanel, StatusChip } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'needs_review';

const SELECTABLE: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

type AttendanceStudent = {
  email: string;
  firstJoinedAt?: string;
  fullName: string;
  lastLeftAt?: string;
  status: string;
  studentProfileId: string;
  suggestedStatus?: string | null;
  teacherNote?: string;
  totalSeconds: number;
};

type AttendanceDraft = {
  lessonSessionId: string;
  students: AttendanceStudent[];
  unmatchedParticipants: Array<{
    displayName: string;
    durationSeconds: number;
    id: string;
    joinedAt: string;
    leftAt?: string;
  }>;
};

const toneByStatus: Record<
  string,
  'emerald' | 'amber' | 'red' | 'blue' | 'gray'
> = {
  absent: 'red',
  excused: 'blue',
  late: 'amber',
  needs_review: 'gray',
  present: 'emerald',
};

const activeButton: Record<AttendanceStatus, string> = {
  absent: 'border-red-500/30 bg-red-50 text-red-700',
  excused: 'border-blue-500/30 bg-blue-50 text-blue-700',
  late: 'border-amber-500/30 bg-amber-50 text-amber-700',
  needs_review: '',
  present: 'border-emerald-500/30 bg-emerald-50 text-emerald-700',
};

function defaultStatus(student: AttendanceStudent): AttendanceStatus {
  if (SELECTABLE.includes(student.status as AttendanceStatus)) {
    return student.status as AttendanceStatus;
  }
  if (
    student.suggestedStatus &&
    SELECTABLE.includes(student.suggestedStatus as AttendanceStatus)
  ) {
    return student.suggestedStatus as AttendanceStatus;
  }
  return 'present';
}

export function AttendanceFormClient({
  initial,
  lessonSessionId,
  locale,
}: {
  initial: AttendanceDraft;
  lessonSessionId: string;
  locale: string;
}) {
  const t = useTranslations('teacher.attendance');
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    initial.students.map((student) => ({
      ...student,
      note: student.teacherNote ?? '',
      selected: defaultStatus(student),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  function setStatus(id: string, status: AttendanceStatus) {
    setRows((current) =>
      current.map((row) =>
        row.studentProfileId === id ? { ...row, selected: status } : row,
      ),
    );
  }

  function setNote(id: string, note: string) {
    setRows((current) =>
      current.map((row) =>
        row.studentProfileId === id ? { ...row, note } : row,
      ),
    );
  }

  async function save() {
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(
        `/api/lessons/${lessonSessionId}/attendance`,
        {
          body: JSON.stringify({
            records: rows.map((row) => ({
              status: row.selected,
              studentProfileId: row.studentProfileId,
              teacherNote: row.note.trim() || undefined,
            })),
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('save_failed');
      setMessage({ text: t('saved'), type: 'success' });
      router.refresh();
    } catch {
      setMessage({ text: t('error'), type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  if (!rows.length) {
    return (
      <ModulePanel className="rounded-3xl text-sm font-semibold text-[#2E286C]/55">
        {t('noStudents')}
      </ModulePanel>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={
            message.type === 'success'
              ? 'rounded-2xl bg-[#0F9F6E]/10 px-4 py-3 text-sm font-semibold text-[#0B7F58]'
              : 'rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </div>
      )}

      {rows.map((row) => (
        <ModulePanel key={row.studentProfileId} className="rounded-3xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={row.fullName} size="md" />
              <div className="min-w-0">
                <h2 className="font-bold text-[#2E286C]">{row.fullName}</h2>
                <p className="mt-0.5 break-all text-xs font-medium text-[#2E286C]/45">
                  {row.email}
                </p>
              </div>
            </div>
            {row.suggestedStatus && (
              <StatusChip tone={toneByStatus[row.suggestedStatus] ?? 'gray'}>
                {t('suggested')}: {t(`statuses.${row.suggestedStatus}`)}
              </StatusChip>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <InfoField
              label={t('joinedAt')}
              value={formatTime(row.firstJoinedAt, locale) ?? t('notJoined')}
            />
            <InfoField
              label={t('leftAt')}
              value={formatTime(row.lastLeftAt, locale) ?? '—'}
            />
            <InfoField
              label={t('duration')}
              value={formatDuration(row.totalSeconds, t)}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {SELECTABLE.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatus(row.studentProfileId, status)}
                className={cn(
                  'min-h-11 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                  row.selected === status
                    ? activeButton[status]
                    : 'border-black/[0.06] bg-white text-[#2E286C]/45 hover:bg-black/[0.02]',
                )}
              >
                {t(`statuses.${status}`)}
              </button>
            ))}
          </div>

          <textarea
            value={row.note}
            onChange={(event) => setNote(row.studentProfileId, event.target.value)}
            placeholder={t('noteHint')}
            maxLength={1000}
            className="mt-3 min-h-16 w-full resize-none rounded-2xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-medium text-[#2E286C] outline-none transition-shadow placeholder:text-[#2E286C]/30 focus:ring-2 focus:ring-[#533089]/15"
          />
        </ModulePanel>
      ))}

      {initial.unmatchedParticipants.length > 0 && (
        <ModulePanel variant="muted" className="rounded-3xl">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
            <UserX className="h-4 w-4" />
            {t('unmatchedTitle')}
          </div>
          <div className="space-y-2">
            {initial.unmatchedParticipants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 text-sm font-medium text-[#2E286C]/70"
              >
                <span>{participant.displayName}</span>
                <span className="text-xs text-[#2E286C]/40">
                  {formatDuration(participant.durationSeconds, t)}
                </span>
              </div>
            ))}
          </div>
        </ModulePanel>
      )}

      <Button onClick={save} disabled={busy}>
        <ClipboardCheck className="h-4 w-4" />
        {busy ? t('saving') : t('save')}
      </Button>
    </div>
  );
}

function formatTime(value: string | undefined, locale: string) {
  if (!value) return undefined;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}

function formatDuration(
  totalSeconds: number,
  t: ReturnType<typeof useTranslations>,
) {
  if (!totalSeconds) return '—';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return t('durationSeconds', { seconds });
  return t('durationMinutes', { minutes });
}
