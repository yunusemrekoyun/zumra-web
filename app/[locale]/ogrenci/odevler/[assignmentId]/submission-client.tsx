'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, CheckCircle2, Clock, Send } from 'lucide-react';
import { type Attachment, AttachmentInput } from '@/components/attachment-input';
import { APP_TIME_ZONE } from '@/lib/datetime';
import type { StudentAssignmentDetail } from '@/lib/server/services/assignments';
import { AttachmentList, Button, ModulePanel, StatusChip } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

export function SubmissionClient({
  data,
  locale,
}: {
  data: StudentAssignmentDetail;
  locale: string;
}) {
  const t = useTranslations('student.assignments');
  const router = useRouter();
  const graded = data.submission?.status === 'graded';

  const [body, setBody] = useState(data.submission?.body ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>(
    data.submission?.attachments.map((item) => ({
      mediaAssetId: item.mediaAssetId,
      name: item.name,
    })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  }>();

  async function submit() {
    if (!body.trim() && !attachments.length) {
      setMessage({ type: 'error', text: t('submit.empty') });
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/assignments/${data.id}/submit`, {
        body: JSON.stringify({
          body: body.trim() || undefined,
          attachmentMediaIds: attachments.map((item) => item.mediaAssetId),
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(responseBody.error ?? 'submit_failed'));
      }
      setMessage({ type: 'success', text: t('submit.saved') });
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const text =
        code === 'attachment_not_ready'
          ? t('submit.attachmentProcessing')
          : code === 'submission_locked'
            ? t('submit.locked')
            : t('submit.error');
      setMessage({ type: 'error', text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ModulePanel className="rounded-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={data.requiresSubmission ? 'purple' : 'blue'}>
            {data.requiresSubmission ? t('type.assignment') : t('type.material')}
          </StatusChip>
          {data.maxScore != null && (
            <StatusChip tone="gray">
              {t('detail.maxScore', { max: data.maxScore })}
            </StatusChip>
          )}
          {data.dueAt && (
            <StatusChip tone="gray" icon={<Clock className="h-3 w-3" />}>
              {formatDate(data.dueAt, locale)}
            </StatusChip>
          )}
          {data.lesson && (
            <StatusChip
              tone="amber"
              icon={<CalendarClock className="h-3 w-3" />}
            >
              {t('detail.linkedLesson')}:{' '}
              {new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: APP_TIME_ZONE,
              }).format(new Date(data.lesson.startsAt))}
            </StatusChip>
          )}
        </div>
        {data.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-6 text-[#2E286C]/70">
            {data.description}
          </p>
        )}
        <AttachmentList attachments={data.attachments} label={t('detail.attachments')} />
      </ModulePanel>

      {data.requiresSubmission &&
        (graded ? (
          <ModulePanel className="rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-bold text-[#2E286C]">
                <CheckCircle2 className="h-5 w-5 text-[#0B7F58]" />
                {t('detail.gradedTitle')}
              </span>
              <StatusChip tone="emerald">
                {t('status.gradedScore', {
                  score: data.submission?.score ?? 0,
                  max: data.maxScore ?? 100,
                })}
              </StatusChip>
            </div>
            {data.submission?.feedback && (
              <div className="mt-4 rounded-2xl bg-[#F8F9FC] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
                  {t('detail.feedback')}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-[#2E286C]/75">
                  {data.submission.feedback}
                </p>
              </div>
            )}
            {data.submission?.body && (
              <div className="mt-3 rounded-2xl border border-black/[0.05] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
                  {t('detail.yourSubmission')}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-[#2E286C]/75">
                  {data.submission.body}
                </p>
              </div>
            )}
            <AttachmentList
              attachments={data.submission?.attachments ?? []}
              label={t('detail.yourAttachments')}
            />
          </ModulePanel>
        ) : (
          <ModulePanel className="space-y-4 rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-[#2E286C]">{t('submit.title')}</h3>
              {data.submission && (
                <StatusChip tone="blue">
                  {t('status.submitted')}
                  {data.submission.isLate ? ` · ${t('status.late')}` : ''}
                </StatusChip>
              )}
            </div>

            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t('submit.bodyHint')}
              maxLength={5000}
              className="min-h-28 w-full resize-none rounded-2xl border border-black/[0.06] bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none transition-shadow placeholder:text-[#2E286C]/30 focus:ring-2 focus:ring-[#533089]/15"
            />

            <AttachmentInput
              value={attachments}
              onChange={setAttachments}
              disabled={busy}
              labels={{
                add: t('submit.attachmentsAdd'),
                uploading: t('submit.attachmentsUploading'),
                error: t('submit.attachmentsError'),
              }}
            />

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

            <Button onClick={submit} disabled={busy}>
              <Send className="h-4 w-4" />
              {busy
                ? t('submit.saving')
                : data.submission
                  ? t('submit.update')
                  : t('submit.submit')}
            </Button>
          </ModulePanel>
        ))}
    </div>
  );
}


function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}
