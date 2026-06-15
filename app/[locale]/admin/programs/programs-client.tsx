'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  GraduationCap,
  Layers3,
  Pencil,
  Plus,
  Save,
  Trash2,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import {
  Button,
  DateRangePicker,
  Input,
  ModulePanel,
  PageHeader,
  StatusChip,
} from '@/components/ui';
import type {
  BranchArchivePreview,
  ProgramCatalogItem,
  ProgramBranchStatus,
  ProgramBranchView,
  ProgramLanguage,
  ProgramLevel,
  ProgramManagementData,
} from '@/lib/server/services/programs';

const languages: ProgramLanguage[] = [
  'english',
  'german',
  'french',
  'arabic',
];
const levels: ProgramLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

type ProgramDraft = {
  active: boolean;
  description: string;
  id?: string;
  language: ProgramLanguage;
  levels: ProgramLevel[];
  listPriceCents: number;
  name: string;
  systemManaged: boolean;
};

type BranchDraft = {
  id?: string;
  instructorProfileId: string;
  maximumCapacity: number;
  minimumCapacity: number;
  name: string;
  notes: string;
  plannedEndDate: string;
  plannedStartDate: string;
  programId: string;
  status: ProgramBranchStatus;
  timezone: string;
};

type TransferDraft = {
  capacityOverride: boolean;
  capacityOverrideNote: string;
  targetBranchId: string;
};

export function ProgramsClient({
  initial,
}: {
  initial: ProgramManagementData;
}) {
  const t = useTranslations('admin.programs');
  const locale = useLocale();
  const [tab, setTab] = useState<'branches' | 'catalog' | 'rates'>('catalog');
  const [programs, setPrograms] = useState(initial.programs);
  const [branches, setBranches] = useState(initial.branches);
  const [rates, setRates] = useState(initial.rates);
  const [showArchived, setShowArchived] = useState(false);
  const [archivePreview, setArchivePreview] =
    useState<BranchArchivePreview>();
  const [archiveReason, setArchiveReason] = useState('');
  const [transferDrafts, setTransferDrafts] = useState<
    Record<string, TransferDraft>
  >({});
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(
    emptyProgram(),
  );
  const groupPrograms = programs.filter(
    (program) => program.kind === 'group' && !program.archivedAt,
  );
  const [branchDraft, setBranchDraft] = useState<BranchDraft>(
    emptyBranch(groupPrograms[0]?.id),
  );
  const [instructorProfileId, setInstructorProfileId] = useState(
    initial.instructors[0]?.id ?? '',
  );
  const [rateLanguage, setRateLanguage] =
    useState<ProgramLanguage>('english');
  const [hourlyPriceCents, setHourlyPriceCents] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const visiblePrograms = programs.filter(
    (program) => showArchived || !program.archivedAt,
  );
  const visibleBranches = branches.filter(
    (branch) => showArchived || !branch.archivedAt,
  );

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        currency: 'TRY',
        style: 'currency',
      }),
    [locale],
  );

  function editProgram(program: ProgramCatalogItem) {
    setProgramDraft({
      active: program.active,
      description: program.description ?? '',
      id: program.id,
      language: program.language ?? 'english',
      levels: program.systemManaged ? ['A1'] : program.levels,
      listPriceCents: program.listPriceCents ?? 0,
      name:
        program.systemKey === 'private-lesson'
          ? t('privateLesson')
          : program.name,
      systemManaged: program.systemManaged,
    });
    setMessage('');
  }

  function editBranch(branch: ProgramBranchView) {
    setBranchDraft({
      id: branch.id,
      instructorProfileId: branch.instructorProfileId ?? '',
      maximumCapacity: branch.maximumCapacity,
      minimumCapacity: branch.minimumCapacity,
      name: branch.name,
      notes: branch.notes ?? '',
      plannedEndDate: branch.plannedEndDate,
      plannedStartDate: branch.plannedStartDate,
      programId: branch.programId,
      status: branch.status,
      timezone: branch.timezone,
    });
    setMessage('');
  }

  async function saveProgram(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/programs', {
        body: JSON.stringify({
          active: programDraft.active,
          description: programDraft.description,
          id: programDraft.id,
          language: programDraft.language,
          levels: programDraft.levels,
          listPriceCents: programDraft.listPriceCents,
          name: programDraft.name,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: programDraft.id ? 'PATCH' : 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) throw new Error('save_failed');

      const next: ProgramCatalogItem = {
        active: programDraft.active,
        archivedAt: programs.find((program) => program.id === body.id)
          ?.archivedAt,
        canDelete:
          programs.find((program) => program.id === body.id)?.canDelete ??
          true,
        description: programDraft.description || undefined,
        id: body.id,
        kind: programDraft.systemManaged ? 'private' : 'group',
        language: programDraft.systemManaged
          ? undefined
          : programDraft.language,
        levels: programDraft.systemManaged ? [] : programDraft.levels,
        listPriceCents: programDraft.systemManaged
          ? undefined
          : programDraft.listPriceCents,
        name: programDraft.name,
        systemKey: programDraft.systemManaged
          ? 'private-lesson'
          : undefined,
        systemManaged: programDraft.systemManaged,
      };
      setPrograms((current) => {
        const exists = current.some((program) => program.id === body.id);
        return exists
          ? current.map((program) => (program.id === body.id ? next : program))
          : [...current, next];
      });
      setBranches((current) =>
        current.map((branch) =>
          branch.programId === body.id
            ? { ...branch, programName: next.name }
            : branch,
        ),
      );
      setProgramDraft(emptyProgram());
      setMessage(t('saved'));
    } catch {
      setMessage(t('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function saveRate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/private-lesson-rates', {
        body: JSON.stringify({
          hourlyPriceCents,
          instructorProfileId,
          language: rateLanguage,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) throw new Error('save_failed');
      const instructor = initial.instructors.find(
        (item) => item.id === instructorProfileId,
      );
      if (!instructor) throw new Error('instructor_missing');

      setRates((current) => [
        ...current.filter(
          (rate) =>
            !(
              rate.instructorProfileId === instructorProfileId &&
              rate.language === rateLanguage
            ),
        ),
        {
          hourlyPriceCents,
          id: body.id,
          instructorName: instructor.name,
          instructorProfileId,
          language: rateLanguage,
        },
      ]);
      setHourlyPriceCents(0);
      setMessage(t('rateSaved'));
    } catch {
      setMessage(t('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function saveBranch(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/program-branches', {
        body: JSON.stringify(branchDraft),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: branchDraft.id ? 'PATCH' : 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) throw new Error('save_failed');

      const program = programs.find(
        (item) => item.id === branchDraft.programId,
      );
      if (!program) throw new Error('program_missing');

      const next: ProgramBranchView = {
        archivedAt: branches.find((branch) => branch.id === body.id)
          ?.archivedAt,
        canDelete:
          branches.find((branch) => branch.id === body.id)?.canDelete ??
          true,
        currentEnrollmentCount:
          branches.find((branch) => branch.id === body.id)
            ?.currentEnrollmentCount ?? 0,
        id: body.id,
        instructorName: initial.instructors.find(
          (item) => item.id === branchDraft.instructorProfileId,
        )?.name,
        instructorProfileId: branchDraft.instructorProfileId || undefined,
        maximumCapacity: branchDraft.maximumCapacity,
        minimumCapacity: branchDraft.minimumCapacity,
        name: branchDraft.name,
        notes: branchDraft.notes || undefined,
        plannedEndDate: branchDraft.plannedEndDate,
        plannedStartDate: branchDraft.plannedStartDate,
        programId: branchDraft.programId,
        programName: program.name,
        status: branchDraft.status,
        timezone: branchDraft.timezone,
      };
      setBranches((current) => {
        const exists = current.some((branch) => branch.id === body.id);
        return exists
          ? current.map((branch) => (branch.id === body.id ? next : branch))
          : [next, ...current];
      });
      setBranchDraft(emptyBranch(groupPrograms[0]?.id));
      setMessage(t('branchSaved'));
    } catch {
      setMessage(t('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function openBranchArchive(branchId: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/program-branches/${branchId}/archive`,
        { credentials: 'same-origin' },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.preview) throw new Error(body.error);
      const preview = body.preview as BranchArchivePreview;
      setArchivePreview(preview);
      setArchiveReason('');
      setTransferDrafts(
        Object.fromEntries(
          preview.students.map((student) => [
            student.enrollmentId,
            {
              capacityOverride: false,
              capacityOverrideNote: '',
              targetBranchId: '',
            },
          ]),
        ),
      );
    } catch {
      setMessage(t('lifecycleError'));
    } finally {
      setBusy(false);
    }
  }

  async function submitBranchArchive() {
    if (!archivePreview || archiveReason.trim().length < 3) return;
    const transfers = archivePreview.students.map((student) => ({
      ...transferDrafts[student.enrollmentId],
      enrollmentId: student.enrollmentId,
    }));
    if (transfers.some((transfer) => !transfer.targetBranchId)) {
      setMessage(t('transferAllRequired'));
      return;
    }

    const projectedCounts = new Map(
      archivePreview.targets.map((target) => [
        target.id,
        target.currentEnrollmentCount,
      ]),
    );
    let capacityApprovalMissing = false;
    for (const transfer of transfers) {
      const target = archivePreview.targets.find(
        (item) => item.id === transfer.targetBranchId,
      );
      const nextCount =
        (projectedCounts.get(transfer.targetBranchId) ?? 0) + 1;
      projectedCounts.set(transfer.targetBranchId, nextCount);
      if (
        target &&
        nextCount > target.maximumCapacity &&
        (!transfer.capacityOverride ||
          transfer.capacityOverrideNote.trim().length < 3)
      ) {
        capacityApprovalMissing = true;
      }
    }
    if (capacityApprovalMissing) {
      setMessage(t('capacityApprovalRequired'));
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/program-branches/${archivePreview.branchId}/archive`,
        {
          body: JSON.stringify({ reason: archiveReason, transfers }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.archivedAt) throw new Error(body.error);

      const transferTargetByEnrollment = new Map(
        transfers.map((transfer) => [
          transfer.enrollmentId,
          transfer.targetBranchId,
        ]),
      );
      const transferredCountByTarget = new Map<string, number>();
      for (const targetId of transferTargetByEnrollment.values()) {
        transferredCountByTarget.set(
          targetId,
          (transferredCountByTarget.get(targetId) ?? 0) + 1,
        );
      }
      setBranches((current) =>
        current.map((branch) => {
          if (branch.id === archivePreview.branchId) {
            return {
              ...branch,
              archivedAt: body.archivedAt,
              currentEnrollmentCount: 0,
              status: body.status,
            };
          }
          const added = transferredCountByTarget.get(branch.id) ?? 0;
          return added
            ? {
                ...branch,
                canDelete: false,
                currentEnrollmentCount:
                  branch.currentEnrollmentCount + added,
              }
            : branch;
        }),
      );
      setArchivePreview(undefined);
      setMessage(t('branchArchived'));
    } catch {
      setMessage(t('lifecycleError'));
    } finally {
      setBusy(false);
    }
  }

  async function archiveCatalogProgram(program: ProgramCatalogItem) {
    if (!window.confirm(t('archiveProgramConfirm'))) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/programs/${program.id}/archive`,
        {
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.archivedAt) {
        if (body.error === 'program_has_unarchived_branches') {
          setTab('branches');
          throw new Error('program_has_unarchived_branches');
        }
        throw new Error(body.error);
      }
      setPrograms((current) =>
        current.map((item) =>
          item.id === program.id
            ? { ...item, active: false, archivedAt: body.archivedAt }
            : item,
        ),
      );
      setMessage(t('programArchived'));
    } catch (error) {
      setMessage(
        error instanceof Error &&
          error.message === 'program_has_unarchived_branches'
          ? t('archiveProgramBranchesFirst')
          : t('lifecycleError'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteCatalogProgram(program: ProgramCatalogItem) {
    if (!window.confirm(t('deleteProgramConfirm'))) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/programs/${program.id}`, {
        credentials: 'same-origin',
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('delete_failed');
      setPrograms((current) =>
        current.filter((item) => item.id !== program.id),
      );
      setMessage(t('programDeleted'));
    } catch {
      setMessage(t('lifecycleError'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCatalogBranch(branch: ProgramBranchView) {
    if (!window.confirm(t('deleteBranchConfirm'))) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/admin/program-branches/${branch.id}`,
        {
          credentials: 'same-origin',
          method: 'DELETE',
        },
      );
      if (!response.ok) throw new Error('delete_failed');
      setBranches((current) =>
        current.filter((item) => item.id !== branch.id),
      );
      setMessage(t('branchDeleted'));
    } catch {
      setMessage(t('lifecycleError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          tab === 'catalog' ? (
            <Button onClick={() => setProgramDraft(emptyProgram())}>
              <Plus className="h-4 w-4" />
              {t('newProgram')}
            </Button>
          ) : tab === 'branches' ? (
            <Button
              onClick={() =>
                setBranchDraft(emptyBranch(groupPrograms[0]?.id))
              }
              disabled={!groupPrograms.length}
            >
              <Plus className="h-4 w-4" />
              {t('newBranch')}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit rounded-2xl bg-white p-1 shadow-sm">
          {(['catalog', 'branches', 'rates'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTab(item);
                setMessage('');
              }}
              className={`min-h-10 rounded-xl px-5 text-xs font-bold transition-colors ${
                tab === item
                  ? 'bg-[#533089] text-white'
                  : 'text-[#2E286C]/50 hover:bg-black/[0.03]'
              }`}
            >
              {t(`tabs.${item}`)}
            </button>
          ))}
        </div>
        {tab !== 'rates' && (
          <label className="flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#2E286C]/60 shadow-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 accent-[#533089]"
            />
            {t('showArchived')}
          </label>
        )}
      </div>

      {message && (
        <div className="mb-5 rounded-2xl bg-[#533089]/7 px-5 py-3 text-sm font-semibold text-[#533089]">
          {message}
        </div>
      )}

      {tab === 'catalog' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="grid gap-4 md:grid-cols-2">
            {visiblePrograms.map((program) => (
              <ModulePanel key={program.id} className="rounded-3xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#533089]/8 text-[#533089]">
                    {program.kind === 'private' ? (
                      <UserRound className="h-5 w-5" />
                    ) : (
                      <GraduationCap className="h-5 w-5" />
                    )}
                  </div>
                  <StatusChip
                    tone={
                      program.archivedAt
                        ? 'gray'
                        : program.active
                          ? 'emerald'
                          : 'gray'
                    }
                  >
                    {program.archivedAt
                      ? t('archived')
                      : program.active
                        ? t('active')
                        : t('inactive')}
                  </StatusChip>
                </div>
                <h2 className="mt-5 text-lg font-bold text-[#2E286C]">
                  {program.systemKey === 'private-lesson'
                    ? t('privateLesson')
                    : program.name}
                </h2>
                <p className="mt-2 min-h-10 text-sm leading-5 text-[#2E286C]/45">
                  {program.description ||
                    (program.kind === 'private'
                      ? t('privateDescription')
                      : t('noDescription'))}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {program.language && (
                    <ProgramTag>
                      {t(`languages.${program.language}`)}
                    </ProgramTag>
                  )}
                  {program.levels.map((level) => (
                    <ProgramTag key={level}>{level}</ProgramTag>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-black/[0.05] pt-5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">
                      {program.kind === 'private'
                        ? t('teacherRate')
                        : t('listPrice')}
                    </div>
                    <div className="mt-1 font-bold text-[#2E286C]">
                      {program.listPriceCents !== undefined
                        ? formatter.format(program.listPriceCents / 100)
                        : t('variablePrice')}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {!program.archivedAt && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => editProgram(program)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('edit')}
                      </Button>
                    )}
                    {!program.systemManaged && !program.archivedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => archiveCatalogProgram(program)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        {t('archive')}
                      </Button>
                    )}
                    {program.canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => deleteCatalogProgram(program)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('delete')}
                      </Button>
                    )}
                  </div>
                </div>
              </ModulePanel>
            ))}
          </div>

          <ModulePanel className="h-fit rounded-3xl p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#533089]/8 text-[#533089]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-[#2E286C]">
                  {programDraft.id ? t('editProgram') : t('createProgram')}
                </h2>
                <p className="text-xs text-[#2E286C]/40">
                  {programDraft.systemManaged
                    ? t('systemProgramNote')
                    : t('formDescription')}
                </p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={saveProgram}>
              <FormField label={t('fields.name')}>
                <Input
                  value={programDraft.name}
                  disabled={programDraft.systemManaged}
                  onChange={(event) =>
                    setProgramDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </FormField>
              {!programDraft.systemManaged && (
                <>
                  <FormField label={t('fields.language')}>
                    <Select
                      value={programDraft.language}
                      onChange={(value) =>
                        setProgramDraft((current) => ({
                          ...current,
                          language: value as ProgramLanguage,
                        }))
                      }
                      options={languages.map((language) => [
                        language,
                        t(`languages.${language}`),
                      ])}
                    />
                  </FormField>
                  <FormField label={t('fields.levels')}>
                    <div className="flex flex-wrap gap-2">
                      {levels.map((level) => {
                        const selected = programDraft.levels.includes(level);
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() =>
                              setProgramDraft((current) => ({
                                ...current,
                                levels: selected
                                  ? current.levels.filter(
                                      (item) => item !== level,
                                    )
                                  : [...current.levels, level],
                              }))
                            }
                            className={`min-h-9 rounded-xl border px-3 text-xs font-bold ${
                              selected
                                ? 'border-[#533089] bg-[#533089] text-white'
                                : 'border-black/10 text-[#2E286C]/50'
                            }`}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </FormField>
                  <FormField label={t('fields.listPrice')}>
                    <MoneyInput
                      cents={programDraft.listPriceCents}
                      onChange={(listPriceCents) =>
                        setProgramDraft((current) => ({
                          ...current,
                          listPriceCents,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label={t('fields.description')}>
                    <textarea
                      value={programDraft.description}
                      onChange={(event) =>
                        setProgramDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      className="min-h-24 w-full resize-y rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
                    />
                  </FormField>
                </>
              )}
              <label className="flex items-center gap-3 rounded-xl bg-[#F8F9FC] p-4 text-sm font-semibold text-[#2E286C]/65">
                <input
                  type="checkbox"
                  checked={programDraft.active}
                  onChange={(event) =>
                    setProgramDraft((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#533089]"
                />
                {t('fields.active')}
              </label>
              <Button
                type="submit"
                className="w-full"
                disabled={
                  busy ||
                  (!programDraft.systemManaged &&
                    (!programDraft.name.trim() ||
                      !programDraft.levels.length))
                }
              >
                <Save className="h-4 w-4" />
                {busy ? t('saving') : t('save')}
              </Button>
            </form>
          </ModulePanel>
        </div>
      ) : tab === 'branches' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="grid gap-4 md:grid-cols-2">
            {visibleBranches.map((branch) => {
              const full =
                branch.currentEnrollmentCount >= branch.maximumCapacity;
              return (
                <ModulePanel key={branch.id} className="rounded-3xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#533089]/8 text-[#533089]">
                      <Layers3 className="h-5 w-5" />
                    </div>
                    <StatusChip
                      tone={
                        branch.archivedAt
                          ? 'gray'
                          : branch.status === 'enrollment_open'
                          ? 'emerald'
                          : branch.status === 'cancelled'
                            ? 'red'
                            : 'gray'
                      }
                    >
                      {branch.archivedAt
                        ? t('archived')
                        : t(`branchStatuses.${branch.status}`)}
                    </StatusChip>
                  </div>
                  <h2 className="mt-5 text-lg font-bold text-[#2E286C]">
                    {branch.name}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#533089]">
                    {branch.programName}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <BranchFact
                      icon={<CalendarDays className="h-4 w-4" />}
                      label={t('branchFields.dateRange')}
                      value={`${formatDate(branch.plannedStartDate, locale)} – ${formatDate(branch.plannedEndDate, locale)}`}
                    />
                    <BranchFact
                      icon={<Users className="h-4 w-4" />}
                      label={t('branchFields.capacity')}
                      value={`${branch.currentEnrollmentCount} / ${branch.maximumCapacity}${full ? ` · ${t('branchFull')}` : ''}`}
                    />
                  </div>
                  <div className="mt-4 rounded-xl bg-[#F8F9FC] px-4 py-3 text-xs font-semibold text-[#2E286C]/50">
                    {branch.instructorName ?? t('teacherAssignmentPending')}
                  </div>
                  <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-black/[0.05] pt-5">
                    {!branch.archivedAt && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => editBranch(branch)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t('edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => openBranchArchive(branch.id)}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          {t('archive')}
                        </Button>
                      </>
                    )}
                    {branch.canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => deleteCatalogBranch(branch)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('delete')}
                      </Button>
                    )}
                  </div>
                </ModulePanel>
              );
            })}
            {!visibleBranches.length && (
              <ModulePanel className="rounded-3xl p-10 text-center md:col-span-2">
                <p className="text-sm font-semibold text-[#2E286C]/45">
                  {t('noBranches')}
                </p>
              </ModulePanel>
            )}
          </div>

          <ModulePanel className="h-fit rounded-3xl p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#533089]/8 text-[#533089]">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-[#2E286C]">
                  {branchDraft.id ? t('editBranch') : t('createBranch')}
                </h2>
                <p className="text-xs text-[#2E286C]/40">
                  {t('branchFormDescription')}
                </p>
              </div>
            </div>

            {groupPrograms.length ? (
              <form className="space-y-4" onSubmit={saveBranch}>
                <FormField label={t('branchFields.program')}>
                  <Select
                    value={branchDraft.programId}
                    onChange={(programId) =>
                      setBranchDraft((current) => ({
                        ...current,
                        programId,
                      }))
                    }
                    options={groupPrograms.map((program) => [
                      program.id,
                      program.name,
                    ])}
                  />
                </FormField>
                <FormField label={t('branchFields.name')}>
                  <Input
                    value={branchDraft.name}
                    onChange={(event) =>
                      setBranchDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FormField label={t('branchFields.dateRange')}>
                      <DateRangePicker
                        startValue={branchDraft.plannedStartDate}
                        endValue={branchDraft.plannedEndDate}
                        locale={locale}
                        placeholders={{
                          start: t('branchFields.startDate'),
                          end: t('branchFields.endDate'),
                        }}
                        onChange={({ start, end }) =>
                          setBranchDraft((current) => ({
                            ...current,
                            plannedEndDate: end,
                            plannedStartDate: start,
                          }))
                        }
                      />
                    </FormField>
                  </div>
                  <FormField label={t('branchFields.minimumCapacity')}>
                    <Input
                      type="number"
                      min="1"
                      value={branchDraft.minimumCapacity}
                      onChange={(event) =>
                        setBranchDraft((current) => ({
                          ...current,
                          minimumCapacity: Math.max(
                            1,
                            Number(event.target.value) || 1,
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <FormField label={t('branchFields.maximumCapacity')}>
                    <Input
                      type="number"
                      min={branchDraft.minimumCapacity}
                      value={branchDraft.maximumCapacity}
                      onChange={(event) =>
                        setBranchDraft((current) => ({
                          ...current,
                          maximumCapacity: Math.max(
                            current.minimumCapacity,
                            Number(event.target.value) ||
                              current.minimumCapacity,
                          ),
                        }))
                      }
                    />
                  </FormField>
                </div>
                <FormField label={t('branchFields.status')}>
                  <Select
                    value={branchDraft.status}
                    onChange={(status) =>
                      setBranchDraft((current) => ({
                        ...current,
                        status: status as ProgramBranchStatus,
                      }))
                    }
                    options={[
                      'draft',
                      'enrollment_open',
                      'enrollment_closed',
                      'in_progress',
                      'completed',
                      'cancelled',
                    ].map((status) => [
                      status,
                      t(
                        `branchStatuses.${status as ProgramBranchStatus}`,
                      ),
                    ])}
                  />
                </FormField>
                <FormField label={t('fields.teacher')}>
                  <Select
                    value={branchDraft.instructorProfileId}
                    onChange={(instructorProfileId) =>
                      setBranchDraft((current) => ({
                        ...current,
                        instructorProfileId,
                      }))
                    }
                    options={[
                      ['', t('teacherAssignmentPending')],
                      ...initial.instructors.map(
                        (instructor) =>
                          [instructor.id, instructor.name] as const,
                      ),
                    ]}
                  />
                </FormField>
                <FormField label={t('branchFields.notes')}>
                  <textarea
                    value={branchDraft.notes}
                    onChange={(event) =>
                      setBranchDraft((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className="min-h-24 w-full resize-y rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
                  />
                </FormField>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    busy ||
                    !branchDraft.programId ||
                    !branchDraft.name.trim() ||
                    !branchDraft.plannedStartDate ||
                    !branchDraft.plannedEndDate ||
                    branchDraft.maximumCapacity <
                      branchDraft.minimumCapacity
                  }
                >
                  <Save className="h-4 w-4" />
                  {busy ? t('saving') : t('saveBranch')}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#533089]/20 p-6 text-center text-sm font-medium text-[#2E286C]/45">
                {t('branchNeedsProgram')}
              </div>
            )}
          </ModulePanel>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <ModulePanel className="h-fit rounded-3xl p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#533089]/8 text-[#533089]">
                <CircleDollarSign className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-[#2E286C]">
                  {t('rateFormTitle')}
                </h2>
                <p className="text-xs text-[#2E286C]/40">
                  {t('rateFormDescription')}
                </p>
              </div>
            </div>
            {initial.instructors.length ? (
              <form className="space-y-4" onSubmit={saveRate}>
                <FormField label={t('fields.teacher')}>
                  <Select
                    value={instructorProfileId}
                    onChange={setInstructorProfileId}
                    options={initial.instructors.map((instructor) => [
                      instructor.id,
                      instructor.name,
                    ])}
                  />
                </FormField>
                <FormField label={t('fields.language')}>
                  <Select
                    value={rateLanguage}
                    onChange={(value) =>
                      setRateLanguage(value as ProgramLanguage)
                    }
                    options={languages.map((language) => [
                      language,
                      t(`languages.${language}`),
                    ])}
                  />
                </FormField>
                <FormField label={t('fields.hourlyStudentPrice')}>
                  <MoneyInput
                    cents={hourlyPriceCents}
                    onChange={setHourlyPriceCents}
                  />
                </FormField>
                <div className="rounded-xl bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-700">
                  {t('rateDisclaimer')}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    busy || !instructorProfileId || hourlyPriceCents <= 0
                  }
                >
                  <Save className="h-4 w-4" />
                  {busy ? t('saving') : t('saveRate')}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#533089]/20 p-6 text-center text-sm font-medium text-[#2E286C]/45">
                {t('noTeachers')}
              </div>
            )}
          </ModulePanel>

          <ModulePanel className="rounded-3xl p-6">
            <h2 className="text-lg font-bold text-[#2E286C]">
              {t('currentRates')}
            </h2>
            <div className="mt-5 divide-y divide-black/[0.05]">
              {rates
                .slice()
                .sort((a, b) =>
                  a.instructorName.localeCompare(b.instructorName),
                )
                .map((rate) => (
                  <div
                    key={rate.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0"
                  >
                    <div>
                      <div className="font-bold text-[#2E286C]">
                        {rate.instructorName}
                      </div>
                      <div className="mt-1 text-xs font-medium text-[#2E286C]/40">
                        {t(`languages.${rate.language}`)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#533089]">
                        {formatter.format(rate.hourlyPriceCents / 100)}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">
                        {t('perHour')}
                      </div>
                    </div>
                  </div>
                ))}
              {!rates.length && (
                <div className="py-10 text-center text-sm font-medium text-[#2E286C]/40">
                  {t('noRates')}
                </div>
              )}
            </div>
          </ModulePanel>
        </div>
      )}

      {archivePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#221B4B]/35 p-3 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-archive-title"
            className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="branch-archive-title"
                    className="text-lg font-bold text-[#2E286C]"
                  >
                    {t('archiveBranchTitle')}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#2E286C]/50">
                    {t('archiveBranchDescription')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('close')}
                onClick={() => setArchivePreview(undefined)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#2E286C]/45 hover:bg-black/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6">
              <FormField label={t('archiveReason')}>
                <textarea
                  value={archiveReason}
                  onChange={(event) => setArchiveReason(event.target.value)}
                  placeholder={t('archiveReasonPlaceholder')}
                  className="min-h-20 w-full resize-y rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
                />
              </FormField>
            </div>

            {archivePreview.students.length ? (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-bold text-[#2E286C]">
                  {t('transferStudents', {
                    count: archivePreview.students.length,
                  })}
                </h3>
                {!archivePreview.targets.length && (
                  <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-5 text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {t('noTransferTarget')}
                  </div>
                )}
                {archivePreview.students.map((student, studentIndex) => {
                  const transfer =
                    transferDrafts[student.enrollmentId] ?? {
                      capacityOverride: false,
                      capacityOverrideNote: '',
                      targetBranchId: '',
                    };
                  const target = archivePreview.targets.find(
                    (item) => item.id === transfer.targetBranchId,
                  );
                  const selectedThroughStudent = archivePreview.students
                    .slice(0, studentIndex + 1)
                    .filter(
                      (item) =>
                        transferDrafts[item.enrollmentId]?.targetBranchId ===
                        transfer.targetBranchId,
                    ).length;
                  const targetWillOverflow = Boolean(
                    target &&
                      target.currentEnrollmentCount + selectedThroughStudent >
                        target.maximumCapacity,
                  );

                  return (
                    <div
                      key={student.enrollmentId}
                      className="rounded-2xl border border-black/[0.06] p-4"
                    >
                      <div className="font-bold text-[#2E286C]">
                        {student.name}
                      </div>
                      <div className="mt-3">
                        <Select
                          value={transfer.targetBranchId}
                          onChange={(targetBranchId) =>
                            setTransferDrafts((current) => ({
                              ...current,
                              [student.enrollmentId]: {
                                ...transfer,
                                targetBranchId,
                              },
                            }))
                          }
                          options={[
                            ['', t('selectTransferTarget')],
                            ...archivePreview.targets.map(
                              (item) =>
                                [
                                  item.id,
                                  `${item.name} · ${item.currentEnrollmentCount}/${item.maximumCapacity}`,
                                ] as const,
                            ),
                          ]}
                        />
                      </div>
                      {targetWillOverflow && (
                        <div className="mt-3 space-y-3 rounded-xl bg-amber-50 p-3">
                          <label className="flex items-start gap-3 text-xs font-bold leading-5 text-amber-800">
                            <input
                              type="checkbox"
                              checked={transfer.capacityOverride}
                              onChange={(event) =>
                                setTransferDrafts((current) => ({
                                  ...current,
                                  [student.enrollmentId]: {
                                    ...transfer,
                                    capacityOverride: event.target.checked,
                                  },
                                }))
                              }
                              className="mt-0.5 h-4 w-4 accent-amber-700"
                            />
                            {t('capacityOverrideApproval')}
                          </label>
                          <Input
                            value={transfer.capacityOverrideNote}
                            onChange={(event) =>
                              setTransferDrafts((current) => ({
                                ...current,
                                [student.enrollmentId]: {
                                  ...transfer,
                                  capacityOverrideNote:
                                    event.target.value,
                                },
                              }))
                            }
                            placeholder={t('capacityOverrideNote')}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                {t('branchHasNoStudents')}
              </div>
            )}

            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-black/[0.06] pt-5">
              <Button
                variant="secondary"
                onClick={() => setArchivePreview(undefined)}
              >
                {t('cancel')}
              </Button>
              <Button
                disabled={
                  busy ||
                  archiveReason.trim().length < 3 ||
                  (archivePreview.students.length > 0 &&
                    archivePreview.targets.length === 0)
                }
                onClick={submitBranchArchive}
              >
                <Archive className="h-4 w-4" />
                {busy ? t('saving') : t('archiveAndTransfer')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgramTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-[#F4F1FA] px-2.5 py-1 text-[10px] font-bold text-[#533089]">
      {children}
    </span>
  );
}

function BranchFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#F8F9FC] p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#2E286C]/35">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xs font-bold text-[#2E286C]">{value}</div>
    </div>
  );
}

function FormField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-2 text-xs font-bold text-[#2E286C]/60">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: Array<readonly [string, string]>;
  value: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none focus:border-[#533089]/30"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function MoneyInput({
  cents,
  onChange,
}: {
  cents: number;
  onChange: (cents: number) => void;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min="0"
        step="0.01"
        value={(cents / 100).toString()}
        onChange={(event) =>
          onChange(Math.max(0, Math.round(Number(event.target.value) * 100)))
        }
        className="pr-14"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#2E286C]/35">
        TRY
      </span>
    </div>
  );
}

function emptyProgram(): ProgramDraft {
  return {
    active: true,
    description: '',
    language: 'english',
    levels: ['A1'],
    listPriceCents: 0,
    name: '',
    systemManaged: false,
  };
}

function emptyBranch(programId = ''): BranchDraft {
  return {
    instructorProfileId: '',
    maximumCapacity: 12,
    minimumCapacity: 4,
    name: '',
    notes: '',
    plannedEndDate: '',
    plannedStartDate: '',
    programId,
    status: 'enrollment_open',
    timezone: 'Europe/Istanbul',
  };
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}
