'use client';

import { useLocale } from 'next-intl';
import { Input, PhoneInput, TagInput } from '@/components/ui';
import type {
  InstructorCompetency,
  InstructorStatus,
} from '@/lib/server/services/instructors';
import type {
  ProgramLanguage,
  ProgramLevel,
} from '@/lib/server/services/programs';

const languages: ProgramLanguage[] = [
  'english',
  'german',
  'french',
  'arabic',
];
const levels: ProgramLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type InstructorEditorValue = {
  biography: string;
  competencies: InstructorCompetency[];
  email: string;
  firstName: string;
  internalNotes: string;
  lastName: string;
  phone: string;
  specialties: string[];
  status: InstructorStatus;
};

type InstructorFieldsProps = {
  labels: {
    biography: string;
    email: string;
    firstName: string;
    internalNotes: string;
    languageLevels: string;
    languages: Record<ProgramLanguage, string>;
    lastName: string;
    noLanguage: string;
    phone: string;
    specialties: string;
    specialtiesPlaceholder: string;
    status: string;
    statuses: Record<InstructorStatus, string>;
  };
  onChange: (value: InstructorEditorValue) => void;
  value: InstructorEditorValue;
};

export function InstructorFields({
  labels,
  onChange,
  value,
}: InstructorFieldsProps) {
  const locale = useLocale();

  function update(patch: Partial<InstructorEditorValue>) {
    onChange({ ...value, ...patch });
  }

  function toggleLanguage(language: ProgramLanguage) {
    const exists = value.competencies.some(
      (item) => item.language === language,
    );
    update({
      competencies: exists
        ? value.competencies.filter((item) => item.language !== language)
        : [...value.competencies, { language, levels: ['A1'] }],
    });
  }

  function toggleLevel(language: ProgramLanguage, level: ProgramLevel) {
    update({
      competencies: value.competencies.map((competency) => {
        if (competency.language !== language) return competency;
        const selected = competency.levels.includes(level);
        const nextLevels = selected
          ? competency.levels.filter((item) => item !== level)
          : [...competency.levels, level];
        return {
          ...competency,
          levels: nextLevels.length ? nextLevels : competency.levels,
        };
      }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.firstName}>
          <Input
            value={value.firstName}
            onChange={(event) => update({ firstName: event.target.value })}
          />
        </Field>
        <Field label={labels.lastName}>
          <Input
            value={value.lastName}
            onChange={(event) => update({ lastName: event.target.value })}
          />
        </Field>
        <Field label={labels.email}>
          <Input
            type="email"
            value={value.email}
            onChange={(event) => update({ email: event.target.value })}
          />
        </Field>
        <Field label={labels.phone}>
          <PhoneInput
            locale={locale}
            value={value.phone}
            onChange={(phone) => update({ phone })}
          />
        </Field>
      </div>

      <Field label={labels.status}>
        <select
          value={value.status}
          onChange={(event) =>
            update({ status: event.target.value as InstructorStatus })
          }
          className="h-11 w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none focus:border-[#533089]/30"
        >
          {(
            [
              'draft',
              'active',
              'on_leave',
              'inactive',
              'archived',
            ] as InstructorStatus[]
          ).map((status) => (
            <option key={status} value={status}>
              {labels.statuses[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field label={labels.languageLevels}>
        <div className="space-y-3 rounded-2xl bg-[#F8F9FC] p-4">
          {languages.map((language) => {
            const competency = value.competencies.find(
              (item) => item.language === language,
            );
            return (
              <div
                key={language}
                className="rounded-xl border border-black/[0.04] bg-white p-3"
              >
                <label className="flex items-center gap-3 text-sm font-bold text-[#2E286C]">
                  <input
                    type="checkbox"
                    checked={Boolean(competency)}
                    onChange={() => toggleLanguage(language)}
                    className="h-4 w-4 accent-[#533089]"
                  />
                  {labels.languages[language]}
                </label>
                {competency && (
                  <div className="mt-3 flex flex-wrap gap-2 pl-7">
                    {levels.map((level) => {
                      const selected = competency.levels.includes(level);
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => toggleLevel(language, level)}
                          className={`min-h-8 rounded-lg border px-3 text-[11px] font-bold ${
                            selected
                              ? 'border-[#533089] bg-[#533089] text-white'
                              : 'border-black/10 text-[#2E286C]/45'
                          }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {!value.competencies.length && (
            <p className="text-xs font-semibold text-amber-700">
              {labels.noLanguage}
            </p>
          )}
        </div>
      </Field>

      <Field label={labels.specialties}>
        <TagInput
          locale={locale}
          value={value.specialties}
          onChange={(specialties) => update({ specialties })}
          placeholder={labels.specialtiesPlaceholder}
        />
      </Field>
      <Field label={labels.biography}>
        <textarea
          value={value.biography}
          onChange={(event) => update({ biography: event.target.value })}
          className="min-h-28 w-full resize-y rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
        />
      </Field>
      <Field label={labels.internalNotes}>
        <textarea
          value={value.internalNotes}
          onChange={(event) => update({ internalNotes: event.target.value })}
          className="min-h-24 w-full resize-y rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
        />
      </Field>
    </div>
  );
}

export function emptyInstructorEditor(): InstructorEditorValue {
  return {
    biography: '',
    competencies: [],
    email: '',
    firstName: '',
    internalNotes: '',
    lastName: '',
    phone: '',
    specialties: [],
    status: 'active',
  };
}

export function editorPayload(value: InstructorEditorValue) {
  return value;
}

function Field({
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
