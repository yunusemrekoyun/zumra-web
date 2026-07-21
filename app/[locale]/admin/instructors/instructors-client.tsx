'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArchiveRestore,
  BookOpenCheck,
  Mail,
  Plus,
  Save,
  Search,
  UserRoundCheck,
} from 'lucide-react';
import {
  Avatar,
  Button,
  FormField,
  Input,
  ModulePanel,
  PageHeader,
  SearchInput,
  StatusChip,
  useToast,
} from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { readApiErrorCode, useApiErrorText } from '@/lib/client/api-error';
import { isValidTurkishIban, normalizeIban } from '@/lib/domain/iban';
import type { InstructorSummary } from '@/lib/server/services/instructors';
import {
  editorPayload,
  emptyInstructorEditor,
  InstructorFields,
  type InstructorEditorValue,
} from './instructor-fields';

export function InstructorsClient({
  initial,
}: {
  initial: InstructorSummary[];
}) {
  const t = useTranslations('admin.instructors');
  const router = useRouter();
  const errorText = useApiErrorText();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [archivedConflict, setArchivedConflict] = useState<{
    email: string;
    fullName: string;
    id: string;
    phone: string;
  }>();
  const [draft, setDraft] = useState<InstructorEditorValue>(
    emptyInstructorEditor(),
  );
  const [bankIban, setBankIban] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankError, setBankError] = useState('');
  const activeCount = initial.filter(
    (instructor) => instructor.status !== 'archived',
  ).length;
  const archivedCount = initial.length - activeCount;
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr-TR');
    const scoped = initial.filter((instructor) =>
      view === 'archived'
        ? instructor.status === 'archived'
        : instructor.status !== 'archived',
    );
    if (!normalized) return scoped;
    return scoped.filter((instructor) =>
      `${instructor.fullName} ${instructor.email} ${instructor.phone}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalized),
    );
  }, [initial, query, view]);

  async function createInstructor(event: FormEvent) {
    event.preventDefault();
    await submitCreate(false);
  }

  async function submitCreate(allowArchivedDuplicate: boolean) {
    const trimmedIban = bankIban.trim();
    if (trimmedIban && !isValidTurkishIban(trimmedIban)) {
      setBankError(t('bank.invalid'));
      return;
    }
    setBankError('');
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/instructors', {
        body: JSON.stringify({
          ...editorPayload(draft),
          allowArchivedDuplicate,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) {
        if (body.error === 'archived_instructor_conflict' && body.instructor) {
          setArchivedConflict(body.instructor);
          setBusy(false);
          return;
        }
        throw new Error(String(body.error ?? 'save_failed'));
      }
      if (trimmedIban) {
        // The instructor is already created; if the IBAN sub-save fails we
        // still navigate but warn the user instead of failing silently — the
        // detail page bank panel allows a retry.
        const bankResponse = await fetch('/api/admin/instructor-bank-accounts', {
          body: JSON.stringify({
            holderName: bankHolder.trim() || undefined,
            iban: normalizeIban(trimmedIban),
            instructorId: body.id,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }).catch(() => null);
        if (!bankResponse || !bankResponse.ok) {
          const bankCode = bankResponse
            ? await readApiErrorCode(bankResponse)
            : 'network_error';
          router.push(`/admin/instructors/${body.id}`);
          toast({
            variant: 'error',
            title: t('bank.saveFailedTitle'),
            description: `${t('bank.saveFailedHint')} (${errorText(bankCode)})`,
          });
          return;
        }
      }
      router.push(`/admin/instructors/${body.id}`);
      toast({ variant: 'success', description: t('saved') });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMessage(
        code === 'instructor_identity_conflict'
          ? t('identityConflict')
          : errorText(code || 'network_error'),
      );
      setBusy(false);
    }
  }

  async function restoreArchivedConflict() {
    if (!archivedConflict) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/instructors/${archivedConflict.id}/restore`,
        {
          credentials: 'same-origin',
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? 'restore_failed'));
      router.push(`/admin/instructors/${archivedConflict.id}`);
    } catch {
      setMessage(t('restoreError'));
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description', { count: initial.length })}
        action={
          <Button
            onClick={() => {
              setCreating((current) => !current);
              setMessage('');
            }}
          >
            <Plus className="h-4 w-4" />
            {t('newInstructor')}
          </Button>
        }
      />

      <div
        className={`grid gap-6 ${
          creating ? 'xl:grid-cols-[minmax(0,1fr)_28rem]' : ''
        }`}
      >
        <ModulePanel padded={false} className="overflow-hidden rounded-3xl">
          <div className="border-b border-black/[0.04] p-4 lg:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('search')}
                containerClassName="max-w-md"
              />
              <div className="flex rounded-2xl bg-[#F8F7FB] p-1">
                {(['active', 'archived'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setView(item)}
                    className={`min-h-10 rounded-xl px-4 text-xs font-bold ${
                      view === item
                        ? 'bg-white text-[#533089] shadow-sm'
                        : 'text-[#2E286C]/45'
                    }`}
                  >
                    {t(`tabs.${item}`, {
                      count: item === 'active' ? activeCount : archivedCount,
                    })}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2 lg:p-6 2xl:grid-cols-3">
            {visible.map((instructor) => (
              <Link
                key={instructor.id}
                href={`/admin/instructors/${instructor.id}`}
                className="block"
              >
                <ModulePanel
                  variant="muted"
                  className="h-full rounded-2xl transition-all hover:border-[#533089]/20 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Avatar name={instructor.fullName} size="lg" />
                    <StatusChip tone={statusTone(instructor.status)}>
                      {t(`statuses.${instructor.status}`)}
                    </StatusChip>
                  </div>
                  <h2 className="mt-4 font-bold text-[#2E286C]">
                    {instructor.fullName}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-xs font-medium text-[#2E286C]/45">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{instructor.email}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {instructor.competencies.map((competency) => (
                      <span
                        key={competency.language}
                        className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-[#533089]"
                      >
                        {t(`languages.${competency.language}`)} ·{' '}
                        {competency.levels.join('/')}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/[0.04] pt-4">
                    <Metric
                      icon={BookOpenCheck}
                      label={t('branches')}
                      value={String(instructor.branchCount)}
                    />
                    <Metric
                      icon={UserRoundCheck}
                      label={t('panelAccount')}
                      value={
                        instructor.userId
                          ? t('accountLinked')
                          : t('accountNotLinked')
                      }
                    />
                  </div>
                </ModulePanel>
              </Link>
            ))}
            {!visible.length && (
              <div className="col-span-full flex min-h-72 flex-col items-center justify-center text-center">
                <Search className="h-8 w-8 text-[#533089]/30" />
                <p className="mt-3 text-sm font-semibold text-[#2E286C]/45">
                  {t('empty')}
                </p>
              </div>
            )}
          </div>
        </ModulePanel>

        {creating && (
          <ModulePanel className="h-fit rounded-3xl p-6">
            <h2 className="text-lg font-bold text-[#2E286C]">
              {t('createTitle')}
            </h2>
            <p className="mt-1 text-xs font-medium text-[#2E286C]/45">
              {t('createDescription')}
            </p>
            <form className="mt-6" onSubmit={createInstructor}>
              <InstructorFields
                labels={fieldLabels(t)}
                value={draft}
                onChange={setDraft}
              />
              <div className="mt-4 space-y-4">
                <FormField
                  label={t('bank.iban')}
                  error={bankError || undefined}
                >
                  <Input
                    value={bankIban}
                    onChange={(event) => {
                      setBankIban(event.target.value.toUpperCase());
                      if (bankError) setBankError('');
                    }}
                    placeholder="TR00 0000 0000 0000 0000 0000 00"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </FormField>
                <FormField label={t('bank.holder')}>
                  <Input
                    value={bankHolder}
                    onChange={(event) => setBankHolder(event.target.value)}
                    maxLength={120}
                  />
                </FormField>
              </div>
              {message && (
                <p className="mt-4 text-sm font-semibold text-red-600">
                  {message}
                </p>
              )}
              <Button
                type="submit"
                className="mt-5 w-full"
                disabled={
                  busy ||
                  !draft.firstName.trim() ||
                  !draft.lastName.trim() ||
                  !draft.email.trim() ||
                  !draft.phone.trim() ||
                  !draft.competencies.length
                }
              >
                <Save className="h-4 w-4" />
                {busy ? t('saving') : t('create')}
              </Button>
            </form>
          </ModulePanel>
        )}
      </div>

      {archivedConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1646]/35 p-4">
          <ModulePanel className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              <ArchiveRestore className="h-4 w-4" />
              {t('archivedConflictBadge')}
            </div>
            <h2 className="text-xl font-bold text-[#2E286C]">
              {t('archivedConflictTitle')}
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#2E286C]/60">
              {t('archivedConflictDescription', {
                name: archivedConflict.fullName,
              })}
            </p>
            <div className="mt-4 rounded-2xl bg-[#F8F7FB] p-4 text-sm font-semibold text-[#2E286C]">
              <div>{archivedConflict.email}</div>
              <div className="mt-1 text-[#2E286C]/50">
                {archivedConflict.phone}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={busy}
                onClick={restoreArchivedConflict}
              >
                {t('restoreOld')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setArchivedConflict(undefined);
                  void submitCreate(true);
                }}
              >
                {t('createSeparate')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setArchivedConflict(undefined)}
              >
                {t('cancel')}
              </Button>
            </div>
          </ModulePanel>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpenCheck;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#2E286C]/35">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xs font-bold text-[#2E286C]">{value}</div>
    </div>
  );
}

function statusTone(status: InstructorSummary['status']) {
  if (status === 'active') return 'emerald' as const;
  if (status === 'on_leave') return 'amber' as const;
  if (status === 'archived') return 'red' as const;
  return 'gray' as const;
}

function fieldLabels(t: ReturnType<typeof useTranslations>) {
  return {
    biography: t('fields.biography'),
    email: t('fields.email'),
    firstName: t('fields.firstName'),
    internalNotes: t('fields.internalNotes'),
    languageLevels: t('fields.languageLevels'),
    languages: {
      arabic: t('languages.arabic'),
      english: t('languages.english'),
      french: t('languages.french'),
      german: t('languages.german'),
    },
    lastName: t('fields.lastName'),
    noLanguage: t('noLanguage'),
    phone: t('fields.phone'),
    specialties: t('fields.specialties'),
    specialtiesPlaceholder: t('fields.specialtiesPlaceholder'),
    status: t('fields.status'),
    statuses: {
      active: t('statuses.active'),
      archived: t('statuses.archived'),
      draft: t('statuses.draft'),
      inactive: t('statuses.inactive'),
      on_leave: t('statuses.on_leave'),
    },
  };
}
