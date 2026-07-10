'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { type Attachment, AttachmentInput } from '@/components/attachment-input';
import {
  Button,
  EntityPickerField,
  FormField,
  Input,
  ModulePanel,
} from '@/components/ui';
import { istanbulWallClockToISO } from '@/lib/datetime';
import type { AssignableLesson } from '@/lib/server/services/assignments';
import { cn } from '@/lib/utils';

type BranchOption = { id: string; name: string };
type StudentOption = {
  enrollmentId: string;
  name: string;
  branchName?: string;
};

export function AssignmentCreateClient({
  locale,
  branches,
  students,
  lessons,
}: {
  locale: string;
  branches: BranchOption[];
  students: StudentOption[];
  lessons: AssignableLesson[];
}) {
  const t = useTranslations('teacher.assignments');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requiresSubmission, setRequiresSubmission] = useState(true);
  const [target, setTarget] = useState('');
  const [lessonSessionId, setLessonSessionId] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [dueAt, setDueAt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // Lessons offered in the picker are scoped to the chosen target.
  const [targetKind, targetId] = target ? target.split(':') : [];
  const lessonOptions = target
    ? lessons.filter((lesson) =>
        targetKind === 'branch'
          ? lesson.branchId === targetId
          : lesson.enrollmentId === targetId,
      )
    : [];
  const lessonFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  async function submit() {
    setError(undefined);
    if (!title.trim()) {
      setError(t('create.errorTitle'));
      return;
    }
    if (!target) {
      setError(t('create.errorTarget'));
      return;
    }

    const [kind, id] = target.split(':');
    const targetPayload =
      kind === 'branch'
        ? { type: 'branch' as const, branchId: id }
        : { type: 'student' as const, enrollmentId: id };

    setBusy(true);
    try {
      const response = await fetch('/api/assignments', {
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          requiresSubmission,
          maxScore: requiresSubmission ? Number(maxScore) || 100 : undefined,
          dueAt: dueAt ? istanbulWallClockToISO(dueAt) : undefined,
          target: targetPayload,
          lessonSessionId: lessonSessionId || undefined,
          attachmentMediaIds: attachments.map((item) => item.mediaAssetId),
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          body.error === 'attachment_not_ready'
            ? t('create.errorProcessing')
            : t('create.error'),
        );
        setBusy(false);
        return;
      }
      window.location.assign(`/${locale}/ogretmen/odevler`);
    } catch {
      setError(t('create.error'));
      setBusy(false);
    }
  }

  return (
    <ModulePanel className="space-y-5 rounded-3xl">
      <div className="flex gap-2">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setRequiresSubmission(value)}
            className={cn(
              'flex-1 rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors',
              requiresSubmission === value
                ? 'border-[#533089]/30 bg-[#533089]/5 text-[#533089]'
                : 'border-black/[0.06] bg-white text-[#2E286C]/45 hover:bg-black/[0.02]',
            )}
          >
            {value ? t('type.assignment') : t('type.material')}
          </button>
        ))}
      </div>

      <FormField label={t('create.titleLabel')} required>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('create.titlePlaceholder')}
          maxLength={200}
        />
      </FormField>

      <FormField label={t('create.descriptionLabel')} optionalLabel={t('optional')}>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('create.descriptionPlaceholder')}
          maxLength={5000}
          className="min-h-24 w-full resize-none rounded-2xl border border-black/[0.06] bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none transition-shadow placeholder:text-[#2E286C]/30 focus:ring-2 focus:ring-[#533089]/15"
        />
      </FormField>

      <FormField label={t('create.targetLabel')} required>
        <EntityPickerField
          filters={[
            ...(branches.length
              ? [{ label: t('create.targetBranches'), value: 'branch' }]
              : []),
            ...(students.length
              ? [{ label: t('create.targetStudents'), value: 'student' }]
              : []),
          ]}
          items={[
            ...branches.map((branch) => ({
              id: `branch:${branch.id}`,
              title: branch.name,
              subtitle: t('create.targetBranches'),
              group: 'branch',
              identity: { kind: 'entity' as const, name: branch.name },
            })),
            ...students.map((student) => ({
              id: `student:${student.enrollmentId}`,
              title: student.name,
              subtitle: student.branchName,
              group: 'student',
              identity: { kind: 'person' as const, name: student.name },
            })),
          ]}
          onSelect={(item) => {
            setTarget(item.id);
            setLessonSessionId('');
          }}
          placeholder={t('create.targetPlaceholder')}
          title={t('create.targetLabel')}
          value={(() => {
            if (!target) return null;
            if (targetKind === 'branch') {
              const branch = branches.find((item) => item.id === targetId);
              return branch
                ? {
                    id: target,
                    title: branch.name,
                    identity: { kind: 'entity' as const, name: branch.name },
                  }
                : null;
            }
            const student = students.find(
              (item) => item.enrollmentId === targetId,
            );
            return student
              ? {
                  id: target,
                  title: student.name,
                  subtitle: student.branchName,
                  identity: { kind: 'person' as const, name: student.name },
                }
              : null;
          })()}
        />
      </FormField>

      {lessonOptions.length > 0 && (
        <FormField
          label={t('create.lessonLabel')}
          optionalLabel={t('optional')}
        >
          <EntityPickerField
            items={[
              ...lessonOptions.map((lesson) => ({
                id: lesson.id,
                title: lessonFormatter.format(new Date(lesson.startsAt)),
                identity: {
                  kind: 'entity' as const,
                  name: lessonFormatter.format(new Date(lesson.startsAt)),
                },
              })),
              ...(lessonSessionId
                ? [
                    {
                      id: '__none__',
                      title: t('create.lessonNone'),
                      identity: { kind: 'entity' as const, name: '—' },
                      meta: { label: '✕', tone: 'red' as const },
                    },
                  ]
                : []),
            ]}
            onSelect={(item) =>
              setLessonSessionId(item.id === '__none__' ? '' : item.id)
            }
            placeholder={t('create.lessonNone')}
            title={t('create.lessonLabel')}
            value={(() => {
              const lesson = lessonOptions.find(
                (item) => item.id === lessonSessionId,
              );
              return lesson
                ? {
                    id: lesson.id,
                    title: lessonFormatter.format(new Date(lesson.startsAt)),
                    identity: {
                      kind: 'entity' as const,
                      name: lessonFormatter.format(new Date(lesson.startsAt)),
                    },
                  }
                : null;
            })()}
          />
        </FormField>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {requiresSubmission && (
          <FormField label={t('create.maxScoreLabel')}>
            <Input
              type="number"
              min={1}
              max={1000}
              value={maxScore}
              onChange={(event) => setMaxScore(event.target.value)}
            />
          </FormField>
        )}
        <FormField label={t('create.dueLabel')} optionalLabel={t('optional')}>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </FormField>
      </div>

      <FormField label={t('create.attachmentsLabel')} optionalLabel={t('optional')}>
        <AttachmentInput
          value={attachments}
          onChange={setAttachments}
          disabled={busy}
          labels={{
            add: t('attachments.add'),
            uploading: t('attachments.uploading'),
            error: t('attachments.error'),
          }}
        />
      </FormField>

      {error && (
        <div className="rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]">
          {error}
        </div>
      )}

      <Button onClick={submit} disabled={busy}>
        <Send className="h-4 w-4" />
        {busy ? t('create.saving') : t('create.submit')}
      </Button>
    </ModulePanel>
  );
}
