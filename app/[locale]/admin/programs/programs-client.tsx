'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BookOpen,
  CircleDollarSign,
  GraduationCap,
  Pencil,
  Plus,
  Save,
  UserRound,
} from 'lucide-react';
import {
  Button,
  Input,
  ModulePanel,
  PageHeader,
  StatusChip,
} from '@/components/ui';
import type {
  ProgramCatalogItem,
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

export function ProgramsClient({
  initial,
}: {
  initial: ProgramManagementData;
}) {
  const t = useTranslations('admin.programs');
  const locale = useLocale();
  const [tab, setTab] = useState<'catalog' | 'rates'>('catalog');
  const [programs, setPrograms] = useState(initial.programs);
  const [rates, setRates] = useState(initial.rates);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(
    emptyProgram(),
  );
  const [teacherUserId, setTeacherUserId] = useState(
    initial.teachers[0]?.id ?? '',
  );
  const [rateLanguage, setRateLanguage] =
    useState<ProgramLanguage>('english');
  const [hourlyPriceCents, setHourlyPriceCents] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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
          language: rateLanguage,
          teacherUserId,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.id) throw new Error('save_failed');
      const teacher = initial.teachers.find(
        (item) => item.id === teacherUserId,
      );
      if (!teacher) throw new Error('teacher_missing');

      setRates((current) => [
        ...current.filter(
          (rate) =>
            !(
              rate.teacherUserId === teacherUserId &&
              rate.language === rateLanguage
            ),
        ),
        {
          hourlyPriceCents,
          id: body.id,
          language: rateLanguage,
          teacherName: teacher.name,
          teacherUserId,
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
          ) : undefined
        }
      />

      <div className="mb-6 flex w-fit rounded-2xl bg-white p-1 shadow-sm">
        {(['catalog', 'rates'] as const).map((item) => (
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

      {message && (
        <div className="mb-5 rounded-2xl bg-[#533089]/7 px-5 py-3 text-sm font-semibold text-[#533089]">
          {message}
        </div>
      )}

      {tab === 'catalog' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="grid gap-4 md:grid-cols-2">
            {programs.map((program) => (
              <ModulePanel key={program.id} className="rounded-3xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#533089]/8 text-[#533089]">
                    {program.kind === 'private' ? (
                      <UserRound className="h-5 w-5" />
                    ) : (
                      <GraduationCap className="h-5 w-5" />
                    )}
                  </div>
                  <StatusChip tone={program.active ? 'emerald' : 'gray'}>
                    {program.active ? t('active') : t('inactive')}
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => editProgram(program)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('edit')}
                  </Button>
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
            {initial.teachers.length ? (
              <form className="space-y-4" onSubmit={saveRate}>
                <FormField label={t('fields.teacher')}>
                  <Select
                    value={teacherUserId}
                    onChange={setTeacherUserId}
                    options={initial.teachers.map((teacher) => [
                      teacher.id,
                      teacher.name,
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
                  disabled={busy || !teacherUserId || hourlyPriceCents <= 0}
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
                .sort((a, b) => a.teacherName.localeCompare(b.teacherName))
                .map((rate) => (
                  <div
                    key={rate.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0"
                  >
                    <div>
                      <div className="font-bold text-[#2E286C]">
                        {rate.teacherName}
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
