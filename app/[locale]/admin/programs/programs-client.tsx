'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DayPicker } from 'react-day-picker';
import { enUS, tr } from 'react-day-picker/locale';
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  BookOpen,
  CalendarDays,
  Clock3,
  CircleDollarSign,
  GraduationCap,
  Layers3,
  Pencil,
  Plus,
  Repeat2,
  Save,
  Trash2,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import {
  EntityPickerField,
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
const marketingIcons = ['message', 'book', 'headset', 'briefcase'] as const;
const lessonTimeOptions = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

type ProgramDraft = {
  active: boolean;
  description: string;
  displayOrder: number;
  id?: string;
  language: ProgramLanguage;
  levels: ProgramLevel[];
  listPriceCents: number;
  marketingIcon: 'book' | 'briefcase' | 'headset' | 'message';
  name: string;
  popular: boolean;
  publicVisible: boolean;
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

type ScheduleDraft = {
  manualDate: string;
  manualLessons: Array<{ date: string; startTime: string }>;
  manualStartTime: string;
  repeatWeekly: boolean;
  startTime: string;
  weekday: number;
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
  const groupPrograms = useMemo(
    () =>
      programs.filter(
        (program) => program.kind === 'group' && !program.archivedAt,
      ),
    [programs],
  );
  const [branchDraft, setBranchDraft] = useState<BranchDraft>(
    emptyBranch(groupPrograms[0]?.id),
  );
  const branchProgram = groupPrograms.find(
    (program) => program.id === branchDraft.programId,
  );
  const compatibleTeacherExists = initial.instructors.some((instructor) =>
    isInstructorCompatible(instructor, branchProgram),
  );
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>(
    emptyScheduleDraft(),
  );
  const [schedulePlannerOpen, setSchedulePlannerOpen] = useState(false);
  const [instructorProfileId, setInstructorProfileId] = useState(
    initial.instructors[0]?.id ?? '',
  );
  const rateInstructor = initial.instructors.find(
    (instructor) => instructor.id === instructorProfileId,
  );
  const rateLanguageSupported = (language: string) =>
    !rateInstructor ||
    rateInstructor.competencies.some((c) => c.language === language);
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
  const manualLessonDates = useMemo(
    () =>
      scheduleDraft.manualLessons
        .map((lesson) => parseScheduleDate(lesson.date))
        .filter((date): date is Date => Boolean(date)),
    [scheduleDraft.manualLessons],
  );
  const scheduleCanSave = Boolean(
    branchDraft.id &&
      branchDraft.instructorProfileId &&
      (scheduleDraft.repeatWeekly
        ? scheduleDraft.startTime
        : scheduleDraft.manualLessons.length) &&
      !busy,
  );

  useEffect(() => {
    if (!groupPrograms.length) return;

    setBranchDraft((current) => {
      const hasValidProgram = groupPrograms.some(
        (program) => program.id === current.programId,
      );

      return hasValidProgram
        ? current
        : { ...current, programId: groupPrograms[0].id };
    });
  }, [groupPrograms]);

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
      displayOrder: program.displayOrder,
      id: program.id,
      language: program.language ?? 'english',
      levels: program.systemManaged ? ['A1'] : program.levels,
      listPriceCents: program.listPriceCents ?? 0,
      marketingIcon: program.marketingIcon ?? 'message',
      name:
        program.systemKey === 'private-lesson'
          ? t('privateLesson')
          : program.name,
      popular: program.popular,
      publicVisible: program.publicVisible,
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
    setScheduleDraft(scheduleDraftFromBranch(branch));
    setSchedulePlannerOpen(false);
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
          displayOrder: programDraft.displayOrder,
          id: programDraft.id,
          language: programDraft.language,
          levels: programDraft.levels,
          listPriceCents: programDraft.listPriceCents,
          marketingIcon: programDraft.marketingIcon,
          name: programDraft.name,
          popular: programDraft.popular,
          publicVisible: programDraft.publicVisible,
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
        displayOrder: programDraft.displayOrder,
        id: body.id,
        kind: programDraft.systemManaged ? 'private' : 'group',
        language: programDraft.systemManaged
          ? undefined
          : programDraft.language,
        levels: programDraft.systemManaged ? [] : programDraft.levels,
        listPriceCents: programDraft.systemManaged
          ? undefined
          : programDraft.listPriceCents,
        marketingIcon: programDraft.systemManaged
          ? undefined
          : programDraft.marketingIcon,
        name: programDraft.name,
        popular: programDraft.systemManaged ? false : programDraft.popular,
        publicVisible: programDraft.systemManaged
          ? false
          : programDraft.publicVisible,
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
      if (!response.ok || !body.id) {
        throw new Error(String(body.error ?? 'save_failed'));
      }
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
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'instructor_language_not_supported') {
        setMessage(t('rateErrors.languageMismatch'));
      } else if (code === 'invalid_private_lesson_rate') {
        setMessage(t('rateErrors.invalidRate'));
      } else {
        setMessage(t('saveError'));
      }
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
      if (!response.ok || !body.id) {
        throw new Error(String(body.error ?? 'save_failed'));
      }

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
        lessonSchedule: branches.find((branch) => branch.id === body.id)
          ?.lessonSchedule,
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
      setBranchDraft(branchDraftFromView(next));
      setScheduleDraft(scheduleDraftFromBranch(next));
      setMessage(t('branchSaved'));
    } catch (error) {
      setMessage(
        branchSaveErrorText(error instanceof Error ? error.message : ''),
      );
    } finally {
      setBusy(false);
    }
  }

  function branchSaveErrorText(code: string) {
    if (code === 'instructor_program_mismatch') {
      return t('branchErrors.instructorMismatch');
    }
    if (code === 'group_program_not_found') {
      return t('branchErrors.groupProgramOnly');
    }
    if (code === 'invalid_program_branch') {
      return t('branchErrors.invalidFields');
    }
    return t('saveError');
  }

  async function saveBranchLessonSchedule(event?: FormEvent) {
    event?.preventDefault();
    if (!branchDraft.id) return;
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch(
        `/api/admin/program-branches/${branchDraft.id}/lesson-schedule`,
        {
          body: JSON.stringify(
            scheduleDraft.repeatWeekly
              ? {
                  repeatWeekly: true,
                  startTime: scheduleDraft.startTime,
                  weekday: scheduleDraft.weekday,
                }
              : {
                  lessons: scheduleDraft.manualLessons,
                  repeatWeekly: false,
                },
          ),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.schedule) throw new Error(body.error);

      setBranches((current) =>
        current.map((branch) =>
          branch.id === branchDraft.id
            ? {
                ...branch,
                canDelete: false,
                lessonSchedule: body.schedule,
              }
            : branch,
        ),
      );
      setScheduleDraft((current) => ({
        ...current,
        manualLessons: body.schedule.sessions ?? current.manualLessons,
      }));
      setSchedulePlannerOpen(false);
      setMessage(t('scheduleSaved'));
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMessage(
        code === 'branch_schedule_instructor_required'
          ? t('scheduleNeedsInstructor')
          : t('scheduleError'),
      );
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

  function addManualLessonForDate(date: string) {
    setScheduleDraft((current) =>
      addManualLesson(current, date, current.manualStartTime),
    );
  }

  function removeManualLesson(date: string, startTime: string) {
    setScheduleDraft((current) => ({
      ...current,
      manualLessons: current.manualLessons.filter(
        (lesson) =>
          lesson.date !== date || lesson.startTime !== startTime,
      ),
    }));
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
              onClick={() => {
                setBranchDraft(emptyBranch(groupPrograms[0]?.id));
                setScheduleDraft(emptyScheduleDraft());
                setSchedulePlannerOpen(false);
              }}
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
                  <label className="flex items-center gap-3 rounded-xl bg-[#F8F9FC] p-4 text-sm font-semibold text-[#2E286C]/65">
                    <input
                      type="checkbox"
                      checked={programDraft.publicVisible}
                      onChange={(event) =>
                        setProgramDraft((current) => ({
                          ...current,
                          publicVisible: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-[#533089]"
                    />
                    {t('fields.publicVisible')}
                  </label>
                  {programDraft.publicVisible && (
                    <>
                      <FormField label={t('fields.marketingIcon')}>
                        <Select
                          value={programDraft.marketingIcon}
                          onChange={(value) =>
                            setProgramDraft((current) => ({
                              ...current,
                              marketingIcon:
                                value as ProgramDraft['marketingIcon'],
                            }))
                          }
                          options={marketingIcons.map((icon) => [
                            icon,
                            t(`marketingIcons.${icon}`),
                          ])}
                        />
                      </FormField>
                      <FormField label={t('fields.displayOrder')}>
                        <input
                          type="number"
                          min={0}
                          value={programDraft.displayOrder}
                          onChange={(event) =>
                            setProgramDraft((current) => ({
                              ...current,
                              displayOrder: Number(event.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
                        />
                      </FormField>
                      <label className="flex items-center gap-3 rounded-xl bg-[#F8F9FC] p-4 text-sm font-semibold text-[#2E286C]/65">
                        <input
                          type="checkbox"
                          checked={programDraft.popular}
                          onChange={(event) =>
                            setProgramDraft((current) => ({
                              ...current,
                              popular: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#533089]"
                        />
                        {t('fields.popular')}
                      </label>
                    </>
                  )}
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
                  <div className="mt-3 rounded-xl bg-[#533089]/7 px-4 py-3 text-xs font-semibold text-[#533089]">
                    {branch.lessonSchedule
                      ? t('scheduleSummary', {
                          count: branch.lessonSchedule.sessionCount,
                        })
                      : t('scheduleMissing')}
                  </div>
                  {branch.lessonSchedule && (
                    <div className="mt-2 rounded-xl bg-[#F8F7FB] px-4 py-3 text-xs font-semibold leading-5 text-[#2E286C]/55">
                      <div>{branchMeetSummary(branch.lessonSchedule, t)}</div>
                      {branchMeetLastError(branch.lessonSchedule) && (
                        <div className="mt-1 break-words text-red-600">
                          {t('meetLastError', {
                            error: branchMeetLastError(
                              branch.lessonSchedule,
                            ) ?? '',
                          })}
                        </div>
                      )}
                    </div>
                  )}
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
              <>
                <form className="space-y-4" onSubmit={saveBranch}>
                  <FormField label={t('branchFields.program')}>
                    <Select
                      value={branchDraft.programId}
                      onChange={(programId) =>
                        setBranchDraft((current) => {
                          const nextProgram = groupPrograms.find(
                            (program) => program.id === programId,
                          );
                          const currentInstructor = initial.instructors.find(
                            (instructor) =>
                              instructor.id === current.instructorProfileId,
                          );
                          return {
                            ...current,
                            programId,
                            // Drop a teacher that isn't qualified for the
                            // newly selected program's language/levels.
                            instructorProfileId: isInstructorCompatible(
                              currentInstructor,
                              nextProgram,
                            )
                              ? current.instructorProfileId
                              : '',
                          };
                        })
                      }
                      options={groupPrograms.map(
                        (program) =>
                          [program.id, program.name] as const,
                      )}
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
                      ].map(
                        (status) =>
                          [
                            status,
                            t(
                              `branchStatuses.${status as ProgramBranchStatus}`,
                            ),
                          ] as const,
                      )}
                    />
                  </FormField>
                  <FormField label={t('fields.teacher')}>
                    <EntityPickerField
                      items={[
                        ...initial.instructors.map((instructor) => {
                          const compatible = isInstructorCompatible(
                            instructor,
                            branchProgram,
                          );
                          return {
                            id: instructor.id,
                            title: instructor.name,
                            identity: {
                              kind: 'person' as const,
                              name: instructor.name,
                            },
                            disabled: !compatible,
                            disabledReason: t('branchTeacherIncompatible'),
                          };
                        }),
                        ...(branchDraft.instructorProfileId
                          ? [
                              {
                                id: '__unassign__',
                                title: t('teacherAssignmentPending'),
                                identity: {
                                  kind: 'person' as const,
                                  name: '—',
                                },
                                meta: {
                                  label: '✕',
                                  tone: 'red' as const,
                                },
                              },
                            ]
                          : []),
                      ]}
                      onSelect={(item) =>
                        setBranchDraft((current) => ({
                          ...current,
                          instructorProfileId:
                            item.id === '__unassign__' ? '' : item.id,
                        }))
                      }
                      placeholder={t('teacherAssignmentPending')}
                      title={t('fields.teacher')}
                      value={(() => {
                        const current = initial.instructors.find(
                          (instructor) =>
                            instructor.id === branchDraft.instructorProfileId,
                        );
                        return current
                          ? {
                              id: current.id,
                              title: current.name,
                              identity: {
                                kind: 'person' as const,
                                name: current.name,
                              },
                            }
                          : null;
                      })()}
                    />
                    <p
                      className={
                        compatibleTeacherExists
                          ? 'mt-2 text-xs font-medium leading-5 text-[#2E286C]/45'
                          : 'mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-700'
                      }
                    >
                      {compatibleTeacherExists
                        ? t('branchTeacherHint')
                        : t('branchTeacherNoneCompatible')}
                    </p>
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
                {branchDraft.id && (
                  <div className="mt-6 border-t border-black/[0.05] pt-6">
                    <button
                      type="button"
                      onClick={() => setSchedulePlannerOpen(true)}
                      className="group w-full rounded-3xl border border-[#533089]/10 bg-gradient-to-br from-[#F8F9FC] to-white p-4 text-left shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#533089]/25 hover:shadow-lg hover:shadow-[#533089]/8 active:scale-[0.99]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#533089]/10 text-[#533089] transition-colors group-hover:bg-[#533089] group-hover:text-white">
                          <Clock3 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-bold text-[#2E286C]">
                              {t('scheduleTitle')}
                            </h3>
                            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#533089] shadow-sm">
                              {t('scheduleOpenPlanner')}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#2E286C]/45">
                            {scheduleDraft.repeatWeekly
                              ? t('weeklySchedulePreview', {
                                  time: scheduleDraft.startTime,
                                  weekday: t(
                                    `weekdays.${scheduleDraft.weekday}`,
                                  ),
                                })
                              : t('manualSchedulePreview', {
                                  count: scheduleDraft.manualLessons.length,
                                })}
                          </p>
                        </div>
                      </div>
                    </button>

                    {!branchDraft.instructorProfileId && (
                      <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-700">
                        {t('scheduleNeedsInstructor')}
                      </div>
                    )}
                  </div>
                )}
              </>
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
                  <EntityPickerField
                    items={initial.instructors.map((instructor) => ({
                      id: instructor.id,
                      title: instructor.name,
                      subtitle: instructor.competencies
                        .map((c) => t(`languages.${c.language}`))
                        .join(' · '),
                      identity: {
                        kind: 'person' as const,
                        name: instructor.name,
                      },
                    }))}
                    onSelect={(item) => {
                      setInstructorProfileId(item.id);
                      // Keep the language selection valid for the new teacher.
                      const next = initial.instructors.find(
                        (i) => i.id === item.id,
                      );
                      if (
                        next &&
                        !next.competencies.some((c) => c.language === rateLanguage)
                      ) {
                        const firstLang = next.competencies[0]?.language;
                        if (firstLang) setRateLanguage(firstLang as ProgramLanguage);
                      }
                    }}
                    placeholder={t('teacherAssignmentPending')}
                    title={t('fields.teacher')}
                    value={(() => {
                      const current = initial.instructors.find(
                        (instructor) => instructor.id === instructorProfileId,
                      );
                      return current
                        ? {
                            id: current.id,
                            title: current.name,
                            identity: {
                              kind: 'person' as const,
                              name: current.name,
                            },
                          }
                        : null;
                    })()}
                  />
                </FormField>
                <FormField label={t('fields.language')}>
                  <Select
                    value={rateLanguage}
                    onChange={(value) =>
                      setRateLanguage(value as ProgramLanguage)
                    }
                    options={languages.map((language) => {
                      const supported = rateLanguageSupported(language);
                      return [
                        language,
                        supported
                          ? t(`languages.${language}`)
                          : `${t(`languages.${language}`)} — ${t('branchTeacherIncompatible')}`,
                        !supported,
                      ] as const;
                    })}
                  />
                  <p className="mt-2 text-xs font-medium leading-5 text-[#2E286C]/45">
                    {t('rateLanguageHint')}
                  </p>
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

      {schedulePlannerOpen && branchDraft.id && (
        <div
          className="zumra-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#221B4B]/35 p-3 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSchedulePlannerOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-schedule-title"
            className="zumra-modal-panel max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white p-4 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#533089]/10 text-[#533089]">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="branch-schedule-title"
                    className="text-lg font-bold text-[#2E286C]"
                  >
                    {t('schedulePlannerTitle')}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-[#2E286C]/50">
                    {t('schedulePlannerDescription')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('close')}
                onClick={() => setSchedulePlannerOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#2E286C]/45 transition-colors hover:bg-black/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!branchDraft.instructorProfileId && (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-700">
                {t('scheduleNeedsInstructor')}
              </div>
            )}

            <div className="mt-5 grid gap-3 rounded-3xl bg-[#F8F9FC] p-1.5 sm:grid-cols-2">
              {[
                ['weekly', t('scheduleModeWeekly')],
                ['manual', t('scheduleModeManual')],
              ].map(([mode, label]) => {
                const active =
                  (mode === 'weekly') === scheduleDraft.repeatWeekly;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setScheduleDraft((current) => ({
                        ...current,
                        repeatWeekly: mode === 'weekly',
                      }))
                    }
                    className={`rounded-2xl px-4 py-3 text-sm font-bold transition-[transform,background-color,color,box-shadow] duration-200 ease-out active:scale-[0.98] ${
                      active
                        ? 'bg-white text-[#533089] shadow-sm'
                        : 'text-[#2E286C]/45 hover:text-[#2E286C]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {scheduleDraft.repeatWeekly ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div>
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#2E286C]/35">
                    {t('chooseWeekday')}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
                      const active = scheduleDraft.weekday === weekday;
                      return (
                        <button
                          key={weekday}
                          type="button"
                          onClick={() =>
                            setScheduleDraft((current) => ({
                              ...current,
                              weekday,
                            }))
                          }
                          className={`rounded-2xl border p-4 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] ${
                            active
                              ? 'border-[#533089] bg-[#533089] text-white shadow-lg shadow-[#533089]/20'
                              : 'border-black/[0.06] bg-[#F8F9FC] text-[#2E286C] hover:border-[#533089]/25'
                          }`}
                        >
                          <div className="text-sm font-bold">
                            {t(`weekdays.${weekday}`)}
                          </div>
                          <div
                            className={`mt-1 text-xs font-semibold ${
                              active ? 'text-white/70' : 'text-[#2E286C]/40'
                            }`}
                          >
                            {t('weeklyRepeat')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-black/[0.06] p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/35">
                    {t('chooseLessonTime')}
                  </div>
                  <TimePickerGrid
                    activeTime={scheduleDraft.startTime}
                    onChange={(startTime) =>
                      setScheduleDraft((current) => ({
                        ...current,
                        startTime,
                      }))
                    }
                  />
                  <FormField label={t('customTime')}>
                    <Input
                      type="time"
                      value={scheduleDraft.startTime}
                      onChange={(event) =>
                        setScheduleDraft((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <div className="mt-4 rounded-2xl bg-[#533089]/7 p-4 text-sm font-bold text-[#533089]">
                    {t('weeklySchedulePreview', {
                      time: scheduleDraft.startTime,
                      weekday: t(`weekdays.${scheduleDraft.weekday}`),
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="rounded-3xl border border-black/[0.06] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/35">
                        {t('chooseDatesFromCalendar')}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#2E286C]/40">
                        {t('clickDateToAdd', {
                          time: scheduleDraft.manualStartTime,
                        })}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#533089]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#533089]">
                      {t('selectedTime', {
                        time: scheduleDraft.manualStartTime,
                      })}
                    </span>
                  </div>
                  <DayPicker
                    mode="single"
                    selected={parseScheduleDate(scheduleDraft.manualDate)}
                    onDayClick={(date) => {
                      const value = serializeScheduleDate(date);
                      if (!dateIsInsideBranch(value, branchDraft)) return;
                      setScheduleDraft((current) => ({
                        ...current,
                        manualDate: value,
                      }));
                      addManualLessonForDate(value);
                    }}
                    locale={locale === 'en' ? enUS : tr}
                    weekStartsOn={1}
                    showOutsideDays
                    fixedWeeks
                    startMonth={parseScheduleDate(
                      branchDraft.plannedStartDate,
                    )}
                    endMonth={parseScheduleDate(branchDraft.plannedEndDate)}
                    disabled={scheduleCalendarDisabledDays(branchDraft)}
                    modifiers={{ booked: manualLessonDates }}
                    modifiersClassNames={{
                      booked: 'zumra-calendar-booked',
                    }}
                    className="zumra-calendar zumra-calendar-large"
                  />
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-black/[0.06] p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/35">
                      {t('chooseLessonTime')}
                    </div>
                    <TimePickerGrid
                      activeTime={scheduleDraft.manualStartTime}
                      onChange={(manualStartTime) =>
                        setScheduleDraft((current) => ({
                          ...current,
                          manualStartTime,
                        }))
                      }
                    />
                    <FormField label={t('customTime')}>
                      <Input
                        type="time"
                        value={scheduleDraft.manualStartTime}
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            manualStartTime: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                  </div>

                  <div className="rounded-3xl border border-black/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/35">
                        {t('selectedLessons')}
                      </div>
                      <span className="rounded-full bg-[#533089]/8 px-3 py-1 text-[10px] font-bold text-[#533089]">
                        {scheduleDraft.manualLessons.length}
                      </span>
                    </div>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {scheduleDraft.manualLessons.map((lesson) => (
                        <div
                          key={`${lesson.date}:${lesson.startTime}`}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-[#F8F9FC] px-4 py-3 text-xs font-semibold text-[#2E286C]"
                        >
                          <span>
                            {formatDate(lesson.date, locale)} ·{' '}
                            {lesson.startTime}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              removeManualLesson(
                                lesson.date,
                                lesson.startTime,
                              )
                            }
                            className="rounded-lg px-2 py-1 text-[#B42318] transition-colors hover:bg-[#B42318]/8"
                          >
                            {t('removeManualLesson')}
                          </button>
                        </div>
                      ))}
                      {!scheduleDraft.manualLessons.length && (
                        <p className="rounded-2xl bg-[#F8F9FC] p-4 text-xs font-semibold leading-5 text-[#2E286C]/45">
                          {t('manualLessonsEmpty')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-black/[0.06] pt-5">
              <Button
                variant="secondary"
                onClick={() => setSchedulePlannerOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                disabled={!scheduleCanSave}
                onClick={() => saveBranchLessonSchedule()}
              >
                <Repeat2 className="h-4 w-4" />
                {busy ? t('saving') : t('saveSchedule')}
              </Button>
            </div>
          </div>
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
  options: Array<readonly [string, string] | readonly [string, string, boolean]>;
  value: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none focus:border-[#533089]/30"
    >
      {options.map(([optionValue, label, disabled]) => (
        <option key={optionValue} value={optionValue} disabled={disabled}>
          {label}
        </option>
      ))}
    </select>
  );
}

// A teacher can only be attached to a branch when they hold a competency for
// the program's language covering ALL of the program's levels (mirrors
// validateBranchInput on the server).
function isInstructorCompatible(
  instructor:
    | { competencies: Array<{ language: string; levels: string[] }> }
    | undefined,
  program: { language?: string; levels: string[] } | undefined,
) {
  if (!instructor) return false;
  if (!program?.language || !program.levels.length) return true;
  return instructor.competencies.some(
    (competency) =>
      competency.language === program.language &&
      program.levels.every((level) => competency.levels.includes(level)),
  );
}

function TimePickerGrid({
  activeTime,
  onChange,
}: {
  activeTime: string;
  onChange: (time: string) => void;
}) {
  return (
    <div className="my-3 grid grid-cols-3 gap-2">
      {lessonTimeOptions.map((time) => {
        const active = activeTime === time;
        return (
          <button
            key={time}
            type="button"
            onClick={() => onChange(time)}
            className={`min-h-10 rounded-xl text-xs font-bold transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.97] ${
              active
                ? 'bg-[#533089] text-white'
                : 'border border-black/[0.06] bg-[#F8F9FC] text-[#2E286C]/60 hover:border-[#533089]/25 hover:text-[#533089]'
            }`}
          >
            {time}
          </button>
        );
      })}
    </div>
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
    displayOrder: 0,
    language: 'english',
    levels: ['A1'],
    listPriceCents: 0,
    marketingIcon: 'message',
    name: '',
    popular: false,
    publicVisible: false,
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

function branchMeetSummary(
  schedule: NonNullable<ProgramBranchView['lessonSchedule']>,
  t: ReturnType<typeof useTranslations>,
) {
  const ready = schedule.sessions.filter(
    (session) => session.meetingStatus === 'ready',
  ).length;
  const failed = schedule.sessions.filter(
    (session) => session.meetingStatus === 'failed',
  ).length;
  const pending = schedule.sessions.filter(
    (session) =>
      session.meetingStatus === 'pending' ||
      session.meetingStatus === 'creating' ||
      session.meetingStatus === 'disabled' ||
      !session.meetingStatus,
  ).length;

  return t('meetSummary', {
    failed,
    pending,
    ready,
    total: schedule.sessions.length,
  });
}

function branchMeetLastError(
  schedule: NonNullable<ProgramBranchView['lessonSchedule']>,
) {
  return schedule.sessions
    .map((session) => session.meetingLastError)
    .find((error): error is string => Boolean(error))
    ?.slice(0, 180);
}

function branchDraftFromView(branch: ProgramBranchView): BranchDraft {
  return {
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
  };
}

function emptyScheduleDraft(branch?: ProgramBranchView): ScheduleDraft {
  return {
    manualDate: branch?.plannedStartDate ?? '',
    manualLessons: [],
    manualStartTime: '10:00',
    repeatWeekly: true,
    startTime: '10:00',
    weekday: 1,
  };
}

function scheduleDraftFromBranch(branch: ProgramBranchView): ScheduleDraft {
  const schedule = branch.lessonSchedule;
  if (!schedule) return emptyScheduleDraft(branch);

  return {
    manualDate: branch.plannedStartDate,
    manualLessons: schedule.repeatWeekly
      ? []
      : schedule.sessions.map((session) => ({
          date: session.date,
          startTime: session.startTime,
        })),
    manualStartTime: schedule.sessions[0]?.startTime ?? '10:00',
    repeatWeekly: schedule.repeatWeekly,
    startTime: schedule.startTime ?? schedule.sessions[0]?.startTime ?? '10:00',
    weekday: schedule.weekday ?? 1,
  };
}

function addManualLesson(
  draft: ScheduleDraft,
  date = draft.manualDate,
  startTime = draft.manualStartTime,
): ScheduleDraft {
  const next = {
    date,
    startTime,
  };
  if (!next.date || !next.startTime) return draft;

  const exists = draft.manualLessons.some(
    (lesson) =>
      lesson.date === next.date && lesson.startTime === next.startTime,
  );

  return {
    ...draft,
    manualLessons: exists
      ? draft.manualLessons
      : [...draft.manualLessons, next].sort((a, b) =>
          `${a.date}:${a.startTime}`.localeCompare(
            `${b.date}:${b.startTime}`,
          ),
        ),
  };
}

function parseScheduleDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function serializeScheduleDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateIsInsideBranch(value: string, branch: BranchDraft) {
  if (!branch.plannedStartDate || !branch.plannedEndDate) return false;
  return value >= branch.plannedStartDate && value <= branch.plannedEndDate;
}

function scheduleCalendarDisabledDays(branch: BranchDraft) {
  const disabled: Array<{ after: Date } | { before: Date }> = [];
  const start = parseScheduleDate(branch.plannedStartDate);
  const end = parseScheduleDate(branch.plannedEndDate);
  if (start) disabled.push({ before: start });
  if (end) disabled.push({ after: end });
  return disabled;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}
