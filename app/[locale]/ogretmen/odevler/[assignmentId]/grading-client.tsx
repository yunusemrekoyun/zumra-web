'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, Paperclip, Star } from 'lucide-react';
import type { AssignmentForGrading } from '@/lib/server/services/assignments';
import { Avatar, Button, ModulePanel, StatusChip } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

type Row = AssignmentForGrading['roster'][number] & {
  scoreInput: string;
  feedbackInput: string;
  busy: boolean;
  saved: boolean;
  failed: boolean;
};

export function GradingClient({
  data,
  locale,
}: {
  data: AssignmentForGrading;
  locale: string;
}) {
  const t = useTranslations('teacher.assignments');
  const router = useRouter();
  const { assignment } = data;
  const [rows, setRows] = useState<Row[]>(() =>
    data.roster.map((row) => ({
      ...row,
      scoreInput: row.submission?.score != null ? String(row.submission.score) : '',
      feedbackInput: row.submission?.feedback ?? '',
      busy: false,
      saved: false,
      failed: false,
    })),
  );

  function patch(index: number, next: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...next } : row)),
    );
  }

  async function grade(index: number) {
    const row = rows[index];
    if (!row.submission) return;
    patch(index, { busy: true, saved: false, failed: false });
    try {
      const response = await fetch(
        `/api/submissions/${row.submission.id}/grade`,
        {
          body: JSON.stringify({
            score: Number(row.scoreInput),
            feedback: row.feedbackInput.trim() || undefined,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('grade_failed');
      patch(index, {
        busy: false,
        saved: true,
        submission: {
          ...row.submission,
          status: 'graded',
          score: Number(row.scoreInput),
          feedback: row.feedbackInput.trim() || undefined,
        },
      });
      router.refresh();
    } catch {
      patch(index, { busy: false, failed: true });
    }
  }

  return (
    <div className="space-y-4">
      <ModulePanel className="rounded-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={assignment.requiresSubmission ? 'purple' : 'blue'}>
            {assignment.requiresSubmission
              ? t('type.assignment')
              : t('type.material')}
          </StatusChip>
          {assignment.maxScore != null && (
            <StatusChip tone="gray">
              {t('grading.maxScore', { max: assignment.maxScore })}
            </StatusChip>
          )}
          {assignment.dueAt && (
            <StatusChip tone="gray" icon={<Clock className="h-3 w-3" />}>
              {formatDate(assignment.dueAt, locale)}
            </StatusChip>
          )}
        </div>
        {assignment.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 text-[#2E286C]/70">
            {assignment.description}
          </p>
        )}
        <AttachmentList attachments={assignment.attachments} label={t('attachments.title')} />
      </ModulePanel>

      {!assignment.requiresSubmission ? (
        <ModulePanel variant="muted" className="rounded-3xl text-sm font-semibold text-[#2E286C]/55">
          {t('grading.materialRecipients', { count: rows.length })}
        </ModulePanel>
      ) : (
        rows.map((row, index) => (
          <ModulePanel key={row.studentProfileId} className="rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={row.studentName} size="md" />
                <h2 className="font-bold text-[#2E286C]">{row.studentName}</h2>
              </div>
              {row.submission ? (
                <StatusChip
                  tone={row.submission.status === 'graded' ? 'emerald' : 'amber'}
                  icon={
                    row.submission.status === 'graded' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : undefined
                  }
                >
                  {row.submission.status === 'graded'
                    ? t('status.graded')
                    : t('status.submitted')}
                  {row.submission.isLate ? ` · ${t('status.late')}` : ''}
                </StatusChip>
              ) : (
                <StatusChip tone="gray">{t('status.not_submitted')}</StatusChip>
              )}
            </div>

            {row.submission ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-[#F8F9FC] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
                    {t('grading.submittedAt', {
                      date: formatDate(row.submission.submittedAt, locale),
                    })}
                  </p>
                  {row.submission.body && (
                    <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-[#2E286C]/75">
                      {row.submission.body}
                    </p>
                  )}
                  <AttachmentList
                    attachments={row.submission.attachments}
                    label={t('attachments.title')}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <div>
                    <label className="text-xs font-bold text-[#2E286C]/60">
                      {t('grading.score')}
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={assignment.maxScore ?? undefined}
                        value={row.scoreInput}
                        onChange={(event) =>
                          patch(index, {
                            scoreInput: event.target.value,
                            saved: false,
                          })
                        }
                        className="h-10 w-20 rounded-xl border border-transparent bg-[#F8F9FC] px-3 text-sm font-bold text-[#2E286C] outline-none focus:border-[#533089]/30"
                      />
                      {assignment.maxScore != null && (
                        <span className="text-xs font-semibold text-[#2E286C]/40">
                          / {assignment.maxScore}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#2E286C]/60">
                      {t('grading.feedback')}
                    </label>
                    <textarea
                      value={row.feedbackInput}
                      onChange={(event) =>
                        patch(index, {
                          feedbackInput: event.target.value,
                          saved: false,
                        })
                      }
                      placeholder={t('grading.feedbackHint')}
                      maxLength={5000}
                      className="mt-1.5 min-h-16 w-full resize-none rounded-2xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-medium text-[#2E286C] outline-none focus:ring-2 focus:ring-[#533089]/15"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={() => grade(index)}
                    disabled={row.busy || row.scoreInput === ''}
                  >
                    <Star className="h-4 w-4" />
                    {row.busy ? t('grading.saving') : t('grading.save')}
                  </Button>
                  {row.saved && (
                    <span className="text-xs font-semibold text-[#0B7F58]">
                      {t('grading.saved')}
                    </span>
                  )}
                  {row.failed && (
                    <span className="text-xs font-semibold text-[#B42318]">
                      {t('grading.error')}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm font-medium text-[#2E286C]/40">
                {t('grading.awaitingSubmission')}
              </p>
            )}
          </ModulePanel>
        ))
      )}
    </div>
  );
}

function AttachmentList({
  attachments,
  label,
}: {
  attachments: { mediaAssetId: string; name: string }[];
  label: string;
}) {
  if (!attachments.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <a
            key={attachment.mediaAssetId}
            href={`/api/media/${attachment.mediaAssetId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white px-2.5 py-1 text-xs font-medium text-[#533089] transition-colors hover:bg-[#533089]/5"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {attachment.name}
          </a>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
