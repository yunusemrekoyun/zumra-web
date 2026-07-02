'use client';

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Printer,
  Plus,
  Save,
  Trash2,
  UserRoundCheck,
} from 'lucide-react';
import {
  ActionBar,
  Button,
  CountrySelect,
  DatePicker,
  FormField,
  IdentityDocumentInput,
  Input,
  ModulePanel,
  PageHeader,
  PhoneInput,
  StatusChip,
} from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import {
  ageOnDate,
  type EnrollmentFieldErrors,
  validateEnrollmentStep,
} from '@/lib/domain/enrollment-validation';
import {
  getTurkeyDistrictOptions,
  getTurkeyProvinceOptions,
} from '@/lib/domain/locations';
import type {
  EnrollmentDraftPatch,
  EnrollmentDraftView,
  EnrollmentPartyInput,
} from '@/lib/server/services/enrollments';
import type {
  ProgramLanguage,
  ProgramManagementData,
} from '@/lib/server/services/programs';

type DraftState = EnrollmentDraftView['draft'] & {
  birthLocationCache: Record<
    string,
    { administrativeArea: string; locality: string }
  >;
  identityDocument: string;
};

const stepNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function EnrollmentWizard({
  catalog,
  initial,
}: {
  catalog: ProgramManagementData;
  initial: EnrollmentDraftView;
}) {
  const t = useTranslations('admin.enrollment');
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initial.draft.currentStep, 9));
  const [highestReachedStep, setHighestReachedStep] = useState(
    Math.min(initial.draft.currentStep, 9),
  );
  const [draft, setDraft] = useState<DraftState>({
    ...initial.draft,
    birthCountryCode: initial.draft.birthCountryCode ?? 'TR',
    birthLocationCache: initial.draft.birthCountryCode
      ? {
          [initial.draft.birthCountryCode]: {
            administrativeArea:
              initial.draft.birthAdministrativeArea ?? '',
            locality: initial.draft.birthLocality ?? '',
          },
        }
      : {},
    identityDocument: '',
  });
  const [parties, setParties] = useState(initial.parties);
  const [documents, setDocuments] = useState(initial.documents);
  const [documentType, setDocumentType] = useState<
    'contract' | 'identity' | 'other' | 'passport' | 'receipt'
  >(initial.draft.identityDocumentType === 'passport' ? 'passport' : 'identity');
  const [confirmationPassword, setConfirmationPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<EnrollmentFieldErrors>({});
  const [lastSavedAt, setLastSavedAt] = useState(initial.draft.lastSavedAt);
  const isCompleted = initial.draft.status === 'completed';
  const progress = Math.round((step / stepNumbers.length) * 100);
  const autosaveSignature = useMemo(
    () => JSON.stringify(buildPatch(step, draft, parties)),
    [draft, parties, step],
  );

  const birthDateIsMinor = useMemo(() => {
    if (!draft.birthDate) return false;
    const age = ageOnDate(draft.birthDate);
    return age !== undefined && age < 18;
  }, [draft.birthDate]);

  useEffect(() => {
    if (
      isCompleted ||
      !canAutosaveStep(step, draft, parties, birthDateIsMinor, catalog)
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/enrollment-drafts/${draft.id}`,
          {
            body: autosaveSignature,
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            method: 'PATCH',
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => ({}));
        if (response.ok && body.savedAt) {
          setLastSavedAt(body.savedAt);
          if (body.draft) {
            setDraft((current) => ({ ...current, ...body.draft }));
          }
        }
      } catch {
        // Explicit step save surfaces errors; background autosave stays quiet.
      }
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    autosaveSignature,
    birthDateIsMinor,
    catalog,
    draft.id,
    draft,
    isCompleted,
    parties,
    step,
  ]);

  async function saveCurrentStep(event?: FormEvent) {
    event?.preventDefault();
    const errors = validateCurrentStep(
      step,
      draft,
      parties,
      birthDateIsMinor,
      t,
    );
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setMessage(t('validation.stepHasErrors'));
      focusField(Object.keys(errors)[0]);
      return;
    }

    setBusy(true);
    setMessage('');
    setFieldErrors({});

    try {
      const payload = buildPatch(step, draft, parties);
      const response = await fetch(
        `/api/admin/enrollment-drafts/${draft.id}`,
        {
          body: JSON.stringify(payload),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const mappedErrors =
          body.fieldErrors ?? enrollmentApiFieldErrors(String(body.error ?? ''), t);
        if (Object.keys(mappedErrors).length) {
          setFieldErrors(mappedErrors);
          setMessage(t('validation.stepHasErrors'));
          focusField(Object.keys(mappedErrors)[0]);
          throw new Error(`field_errors:${body.error ?? 'save_failed'}`);
        }
        throw new Error(body.error ?? 'save_failed');
      }
      setLastSavedAt(body.savedAt);
      if (body.draft) {
        setDraft((current) => ({ ...current, ...body.draft }));
      }
      setMessage(t('saved'));
      if (step < 9) {
        const nextStep = step + 1;
        setHighestReachedStep((current) => Math.max(current, nextStep));
        setStep(nextStep);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (!code.startsWith('field_errors:')) {
        setMessage(t('saveError'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setMessage('');

    try {
      await saveStepNineOnly();
      const response = await fetch(
        `/api/admin/enrollment-drafts/${draft.id}/complete`,
        {
          body: JSON.stringify({ locale, password: confirmationPassword }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const mappedErrors = enrollmentApiFieldErrors(
          String(body.error ?? ''),
          t,
        );
        if (Object.keys(mappedErrors).length) {
          setFieldErrors(mappedErrors);
          setMessage(t('validation.stepHasErrors'));
          const targetStep =
            mappedErrors.studentUsername || mappedErrors.email ? 2 : step;
          setStep(targetStep);
          setHighestReachedStep((current) => Math.max(current, targetStep));
          focusField(Object.keys(mappedErrors)[0]);
          throw new Error(`field_errors:${body.error ?? 'complete_failed'}`);
        }
        throw new Error(body.error ?? 'complete_failed');
      }
      setMessage(t('completed'));
      router.push('/admin/leads');
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code.startsWith('enrollment_incomplete:')) {
        const missingFields = code
          .slice('enrollment_incomplete:'.length)
          .split(',')
          .filter(Boolean);
        const firstMissingStep = Math.min(
          ...missingFields.map(enrollmentIssueStep),
        );
        const targetStep = Number.isFinite(firstMissingStep)
          ? firstMissingStep
          : 1;
        setStep(targetStep);
        setHighestReachedStep((current) => Math.max(current, targetStep));
        const firstField = enrollmentIssueField(missingFields[0]);
        if (firstField) focusField(firstField);
        setMessage(
          t('incompleteFields', {
            fields: missingFields
              .map((field) => t(`validation.${field}`))
              .join(', '),
          }),
        );
      } else if (!code.startsWith('field_errors:')) {
        setMessage(
          code === 'forbidden'
            ? t('confirmationError')
            : t('completeError'),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveStepNineOnly() {
    const response = await fetch(
      `/api/admin/enrollment-drafts/${draft.id}`,
      {
        body: JSON.stringify(buildPatch(9, draft, parties)),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error ?? 'save_failed');
    }
    setLastSavedAt(body.savedAt);
  }

  async function uploadDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');

    try {
      const mediaResponse = await fetch('/api/media', {
        body: file,
        credentials: 'same-origin',
        headers: {
          'x-file-name': file.name,
          'x-media-kind': file.type.startsWith('image/')
            ? 'image'
            : 'document',
          'x-media-visibility': 'private',
        },
        method: 'POST',
      });
      const media = await mediaResponse.json().catch(() => ({}));
      if (!mediaResponse.ok || !media.id) {
        throw new Error('upload_failed');
      }

      const attachResponse = await fetch(
        `/api/admin/enrollment-drafts/${draft.id}/documents`,
        {
          body: JSON.stringify({
            label: file.name,
            mediaAssetId: media.id,
            type: documentType,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      const attached = await attachResponse.json().catch(() => ({}));
      if (!attachResponse.ok) {
        throw new Error('attach_failed');
      }
      setDocuments((current) => [
        ...current,
        {
          id: attached.id,
          label: file.name,
          mediaAssetId: media.id,
          status: 'pending',
          type: documentType,
        },
      ]);
      setMessage(t('documentUploaded'));
    } catch {
      setMessage(t('documentError'));
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  }

  async function removeDocument(documentId: string) {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/enrollment-drafts/${draft.id}/documents?documentId=${documentId}`,
        { credentials: 'same-origin', method: 'DELETE' },
      );
      if (!response.ok) throw new Error('remove_failed');
      setDocuments((current) =>
        current.filter((document) => document.id !== documentId),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description', {
          name: `${draft.firstName} ${draft.lastName}`,
        })}
        action={
          <StatusChip tone={isCompleted ? 'emerald' : 'purple'}>
            {isCompleted ? t('status.completed') : t('status.draft')}
          </StatusChip>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <ModulePanel className="h-fit rounded-3xl">
          <Link
            href="/admin/leads"
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#533089]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#533089]/8">
            <div
              className="h-full rounded-full bg-[#533089] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-1.5">
            {stepNumbers.map((number) => (
              <button
                key={number}
                type="button"
                disabled={busy || number > highestReachedStep}
                onClick={() => setStep(number)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                  step === number
                    ? 'bg-[#533089] text-white'
                    : number < highestReachedStep
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-[#2E286C]/55 hover:bg-black/[0.03]'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current/20">
                  {number < highestReachedStep ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    number
                  )}
                </span>
                {t(`steps.${number}`)}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#F8F7FB] p-4 text-xs font-medium leading-5 text-[#2E286C]/55">
            <div className="font-bold text-[#2E286C]">{t('registeredBy')}</div>
            <div>{initial.createdByName}</div>
            <div className="mt-3 text-[10px] uppercase tracking-wider">
              {t('lastSaved', {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(lastSavedAt)),
              })}
            </div>
          </div>
        </ModulePanel>

        <form onSubmit={saveCurrentStep}>
          <ModulePanel className="rounded-3xl p-5 sm:p-7 lg:p-9">
            <div className="mb-8">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#533089]">
                {t('stepLabel', { current: step, total: 9 })}
              </div>
              <h2 className="mt-2 text-2xl font-medium text-[#2E286C]">
                {t(`stepTitles.${step}`)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#2E286C]/50">
                {t(`stepDescriptions.${step}`)}
              </p>
            </div>

            {step === 1 && (
              <IdentityStep
                draft={draft}
                errors={fieldErrors}
                setDraft={setDraft}
                t={t}
              />
            )}
            {step === 2 && (
              <ContactStep
                draft={draft}
                isMinor={birthDateIsMinor}
                parties={parties}
                setDraft={setDraft}
                setParties={setParties}
                t={t}
                errors={fieldErrors}
              />
            )}
            {step === 3 && (
              <ProgramStep
                catalog={catalog}
                draft={draft}
                setDraft={setDraft}
                t={t}
                errors={fieldErrors}
              />
            )}
            {step === 4 && (
              <SourceStep
                draft={draft}
                originalSource={initial.candidate.originalSource}
                setDraft={setDraft}
                t={t}
                errors={fieldErrors}
              />
            )}
            {step === 5 && (
              <ChannelStep
                draft={draft}
                errors={fieldErrors}
                setDraft={setDraft}
                t={t}
              />
            )}
            {step === 6 && (
              <DocumentsStep
                busy={busy}
                documents={documents}
                documentType={documentType}
                onRemove={removeDocument}
                onUpload={uploadDocument}
                setDocumentType={setDocumentType}
                t={t}
              />
            )}
            {step === 7 && (
              <FinanceStep
                draft={draft}
                errors={fieldErrors}
                setDraft={setDraft}
                t={t}
              />
            )}
            {step === 8 && (
              <ScheduleStep
                catalog={catalog}
                draft={draft}
                setDraft={setDraft}
                t={t}
              />
            )}
            {step === 9 && (
              <ReviewStep
                documents={documents}
                draft={draft}
                isMinor={birthDateIsMinor}
                parties={parties}
                confirmationPassword={confirmationPassword}
                setConfirmationPassword={setConfirmationPassword}
                setDraft={setDraft}
                onIssueClick={(issue, issueStep) => {
                  const targetStep = issueStep ?? enrollmentIssueStep(issue);
                  setStep(targetStep);
                  setHighestReachedStep((current) =>
                    Math.max(current, targetStep),
                  );
                  const field = enrollmentIssueField(issue);
                  if (field) focusField(field);
                }}
                t={t}
              />
            )}

            <div className="mt-10 border-t border-black/[0.04] pt-6">
              {message && (
                <p className="mb-4 text-sm font-semibold text-[#533089]">
                  {message}
                </p>
              )}
              <ActionBar className="justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || step === 1}
                  onClick={() => setStep((current) => Math.max(1, current - 1))}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('previous')}
                </Button>
                {step < 9 ? (
                  <Button type="submit" disabled={busy || isCompleted}>
                    {busy ? t('saving') : t('next')}
                    {busy ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={
                      busy ||
                      isCompleted ||
                      confirmationPassword.length < 12
                    }
                    onClick={complete}
                  >
                    <UserRoundCheck className="h-4 w-4" />
                    {busy ? t('saving') : t('complete')}
                  </Button>
                )}
              </ActionBar>
            </div>
          </ModulePanel>
        </form>
      </div>
    </div>
  );
}

type WizardT = ReturnType<typeof useTranslations>;
type SetDraft = React.Dispatch<React.SetStateAction<DraftState>>;

function IdentityStep({
  draft,
  errors,
  setDraft,
  t,
}: {
  draft: DraftState;
  errors: EnrollmentFieldErrors;
  setDraft: SetDraft;
  t: WizardT;
}) {
  const locale = useLocale();
  const isTurkey = (draft.birthCountryCode ?? 'TR') === 'TR';
  const provinces = getTurkeyProvinceOptions();
  const districts = getTurkeyDistrictOptions(
    draft.birthAdministrativeArea ?? '',
  );
  const identityType = draft.identityDocumentType ?? 'national_id';

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SelectField
        id="identityDocumentType"
        label={t('fields.identityType')}
        value={identityType}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            identityDocument: '',
            identityDocumentMasked:
              current.identityDocumentType === value
                ? current.identityDocumentMasked
                : undefined,
            identityDocumentType: value as 'national_id' | 'passport',
          }))
        }
        options={[
          ['national_id', t('options.nationalId')],
          ['passport', t('options.passport')],
        ]}
      />
      <FormField
        error={errors.identityDocument}
        htmlFor="identityDocument"
        label={
          identityType === 'national_id'
            ? t('fields.nationalIdNumber')
            : t('fields.passportNumber')
        }
      >
        <IdentityDocumentInput
          error={Boolean(errors.identityDocument)}
          id="identityDocument"
          maskedValue={draft.identityDocumentMasked}
          onChange={(identityDocument) =>
            setDraft((current) => ({ ...current, identityDocument }))
          }
          placeholder={
            draft.identityDocumentMasked
              ? t('fields.leaveBlankToKeep')
              : t('fields.identityPlaceholder')
          }
          type={identityType}
          value={draft.identityDocument}
        />
      </FormField>
      <Field
        error={errors.firstName}
        id="firstName"
        label={t('fields.firstName')}
        required
        value={draft.firstName}
        onChange={(value) =>
          setDraft((current) => ({ ...current, firstName: value }))
        }
      />
      <Field
        error={errors.lastName}
        id="lastName"
        label={t('fields.lastName')}
        required
        value={draft.lastName}
        onChange={(value) =>
          setDraft((current) => ({ ...current, lastName: value }))
        }
      />
      <FormField
        error={errors.birthCountryCode}
        htmlFor="birthCountryCode"
        label={t('fields.birthCountry')}
      >
        <CountrySelect
          error={Boolean(errors.birthCountryCode)}
          id="birthCountryCode"
          locale={locale}
          onChange={(birthCountryCode) =>
            setDraft((current) => {
              const currentCode = current.birthCountryCode ?? 'TR';
              const cache = {
                ...current.birthLocationCache,
                [currentCode]: {
                  administrativeArea:
                    current.birthAdministrativeArea ?? '',
                  locality: current.birthLocality ?? '',
                },
              };
              const restored = cache[birthCountryCode];
              return {
                ...current,
                birthAdministrativeArea:
                  restored?.administrativeArea ?? '',
                birthCountryCode,
                birthLocality: restored?.locality ?? '',
                birthLocationCache: cache,
              };
            })
          }
          placeholder={t('select')}
          value={draft.birthCountryCode ?? 'TR'}
        />
      </FormField>
      {isTurkey ? (
        <>
          <SelectField
            error={errors.birthAdministrativeArea}
            id="birthAdministrativeArea"
            label={t('fields.birthProvince')}
            value={draft.birthAdministrativeArea ?? ''}
            onChange={(birthAdministrativeArea) =>
              setDraft((current) => ({
                ...current,
                birthAdministrativeArea,
                birthLocality: '',
              }))
            }
            options={[
              ['', t('select')],
              ...provinces.map((province) => [province, province] as const),
            ]}
          />
          <SelectField
            error={errors.birthLocality}
            id="birthLocality"
            label={t('fields.birthDistrict')}
            value={draft.birthLocality ?? ''}
            onChange={(birthLocality) =>
              setDraft((current) => ({ ...current, birthLocality }))
            }
            options={[
              ['', t('select')],
              ...districts.map((district) => [district, district] as const),
            ]}
          />
        </>
      ) : (
        <>
          <Field
            error={errors.birthAdministrativeArea}
            id="birthAdministrativeArea"
            label={t('fields.birthRegion')}
            value={draft.birthAdministrativeArea ?? ''}
            onChange={(birthAdministrativeArea) =>
              setDraft((current) => ({
                ...current,
                birthAdministrativeArea,
              }))
            }
          />
          <Field
            error={errors.birthLocality}
            id="birthLocality"
            label={t('fields.birthCity')}
            value={draft.birthLocality ?? ''}
            onChange={(birthLocality) =>
              setDraft((current) => ({ ...current, birthLocality }))
            }
          />
        </>
      )}
      <FormField
        error={errors.birthDate}
        htmlFor="birthDate"
        label={t('fields.birthDate')}
      >
        <DatePicker
          disabledAfter={new Date()}
          error={Boolean(errors.birthDate)}
          id="birthDate"
          locale={locale}
          onChange={(birthDate) =>
            setDraft((current) => ({ ...current, birthDate }))
          }
          placeholder={t('fields.datePlaceholder')}
          value={draft.birthDate ?? ''}
        />
      </FormField>
      <SelectField
        error={errors.gender}
        id="gender"
        label={t('fields.gender')}
        value={draft.gender ?? ''}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            gender: value as DraftState['gender'],
          }))
        }
        options={[
          ['', t('select')],
          ['female', t('options.female')],
          ['male', t('options.male')],
          ['non_binary', t('options.nonBinary')],
          ['other', t('options.other')],
          ['prefer_not_to_say', t('options.preferNotToSay')],
        ]}
      />
      <Field
        error={errors.school}
        id="school"
        label={t('fields.school')}
        value={draft.school ?? ''}
        onChange={(value) =>
          setDraft((current) => ({ ...current, school: value }))
        }
      />
    </div>
  );
}

function ContactStep({
  draft,
  errors,
  isMinor,
  parties,
  setDraft,
  setParties,
  t,
}: {
  draft: DraftState;
  errors: EnrollmentFieldErrors;
  isMinor: boolean;
  parties: EnrollmentDraftView['parties'];
  setDraft: SetDraft;
  setParties: React.Dispatch<
    React.SetStateAction<EnrollmentDraftView['parties']>
  >;
  t: WizardT;
}) {
  const locale = useLocale();

  function addParty() {
    setParties((current) => [
      ...current,
      {
        fullName: '',
        id: crypto.randomUUID(),
        relationship: 'mother',
        roles: isMinor ? ['guardian'] : ['payer'],
      },
    ]);
  }

  return (
    <div className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          error={errors.primaryPhone}
          htmlFor="primaryPhone"
          label={t('fields.primaryPhone')}
          required
        >
          <PhoneInput
            error={Boolean(errors.primaryPhone)}
            id="primaryPhone"
            locale={locale}
            value={draft.primaryPhone}
            onChange={(primaryPhone) =>
              setDraft((current) => ({ ...current, primaryPhone }))
            }
          />
        </FormField>
        <FormField
          error={errors.secondaryPhone}
          htmlFor="secondaryPhone"
          label={t('fields.secondaryPhone')}
          optionalLabel={t('optional')}
        >
          <PhoneInput
            error={Boolean(errors.secondaryPhone)}
            id="secondaryPhone"
            locale={locale}
            value={draft.secondaryPhone ?? ''}
            onChange={(secondaryPhone) =>
              setDraft((current) => ({ ...current, secondaryPhone }))
            }
          />
        </FormField>
        <Field
          error={errors.email}
          id="email"
          label={t('fields.email')}
          required
          type="email"
          value={draft.email}
          onChange={(value) =>
            setDraft((current) => ({ ...current, email: value }))
          }
        />
        <Field
          error={errors.studentUsername}
          id="studentUsername"
          label={t('fields.studentUsername')}
          required
          value={draft.studentUsername ?? ''}
          onChange={(value) =>
            setDraft((current) => ({ ...current, studentUsername: value }))
          }
        />
        <div className="sm:col-span-2">
          <TextAreaField
            error={errors.residenceAddress}
            id="residenceAddress"
            label={t('fields.address')}
            required
            value={draft.residenceAddress}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                residenceAddress: value,
              }))
            }
          />
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-[#F8F7FB] p-4 text-sm font-semibold text-[#2E286C]/65">
        <input
          type="checkbox"
          checked={draft.studentIsContractParty}
          disabled={isMinor}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              studentIsContractParty: event.target.checked,
            }))
          }
          className="mt-0.5 h-4 w-4 accent-[#533089]"
        />
        {isMinor
          ? t('minorGuardianRequired')
          : t('studentContractParty')}
      </label>

      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-[#2E286C]">
            {t('contractParties')}
          </h3>
          <Button type="button" variant="secondary" size="sm" onClick={addParty}>
            <Plus className="h-4 w-4" />
            {t('addParty')}
          </Button>
        </div>
        <div className="space-y-4">
          {parties.map((party, index) => (
            <PartyEditor
              errors={errors}
              key={party.id}
              index={index}
              party={party}
              setParties={setParties}
              t={t}
            />
          ))}
          {!parties.length && (
            <div className="rounded-2xl border border-dashed border-[#533089]/20 p-6 text-center text-sm font-medium text-[#2E286C]/40">
              {t('noParties')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PartyEditor({
  errors,
  index,
  party,
  setParties,
  t,
}: {
  errors: EnrollmentFieldErrors;
  index: number;
  party: EnrollmentDraftView['parties'][number];
  setParties: React.Dispatch<
    React.SetStateAction<EnrollmentDraftView['parties']>
  >;
  t: WizardT;
}) {
  const locale = useLocale();
  const partyPrefix = `party-${party.id}`;
  function update(values: Partial<typeof party>) {
    setParties((current) =>
      current.map((item) =>
        item.id === party.id ? { ...item, ...values } : item,
      ),
    );
  }

  function toggleRole(role: EnrollmentPartyInput['roles'][number]) {
    const roles = party.roles.includes(role)
      ? party.roles.filter((item) => item !== role)
      : [...party.roles, role];
    update({ roles });
  }

  return (
    <div className="rounded-2xl border border-black/[0.05] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="text-sm font-bold text-[#2E286C]">
          {t('partyNumber', { number: index + 1 })}
        </div>
        <button
          type="button"
          aria-label={t('removeParty')}
          onClick={() =>
            setParties((current) =>
              current.filter((item) => item.id !== party.id),
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={errors[`${partyPrefix}-fullName`]}
          id={`${partyPrefix}-fullName`}
          label={t('fields.fullName')}
          required
          value={party.fullName}
          onChange={(value) => update({ fullName: value })}
        />
        <SelectField
          error={errors[`${partyPrefix}-relationship`]}
          id={`${partyPrefix}-relationship`}
          label={t('fields.relationship')}
          required
          value={party.relationship}
          onChange={(value) =>
            update({
              relationship:
                value as EnrollmentDraftView['parties'][number]['relationship'],
            })
          }
          options={[
            ['mother', t('options.mother')],
            ['father', t('options.father')],
            ['sibling', t('options.sibling')],
            ['other', t('options.other')],
          ]}
        />
        {party.relationship === 'other' && (
          <Field
            error={errors[`${partyPrefix}-relationshipOther`]}
            id={`${partyPrefix}-relationshipOther`}
            label={t('fields.relationshipOther')}
            required
            value={party.relationshipOther ?? ''}
            onChange={(value) => update({ relationshipOther: value })}
          />
        )}
        <FormField
          error={errors[`${partyPrefix}-phone`]}
          htmlFor={`${partyPrefix}-phone`}
          label={t('fields.phone')}
          optionalLabel={t('optional')}
        >
          <PhoneInput
            error={Boolean(errors[`${partyPrefix}-phone`])}
            id={`${partyPrefix}-phone`}
            locale={locale}
            value={party.phone ?? ''}
            onChange={(phone) => update({ phone })}
          />
        </FormField>
        <Field
          error={errors[`${partyPrefix}-email`]}
          id={`${partyPrefix}-email`}
          label={t('fields.email')}
          optionalLabel={t('optional')}
          type="email"
          value={party.email ?? ''}
          onChange={(value) => update({ email: value })}
        />
        <SelectField
          id={`${partyPrefix}-identityType`}
          label={t('fields.identityType')}
          optionalLabel={t('optional')}
          value={party.identityDocumentType ?? ''}
          onChange={(value) =>
            update({
              identityDocumentMasked:
                party.identityDocumentType === value
                  ? party.identityDocumentMasked
                  : undefined,
              identityDocumentType:
                (value || undefined) as
                  | 'national_id'
                  | 'passport'
                  | undefined,
            })
          }
          options={[
            ['', t('select')],
            ['national_id', t('options.nationalId')],
            ['passport', t('options.passport')],
          ]}
        />
        {party.identityDocumentType && (
          <FormField
            error={errors[`${partyPrefix}-identityDocument`]}
            htmlFor={`${partyPrefix}-identityDocument`}
            label={
              party.identityDocumentType === 'national_id'
                ? t('fields.nationalIdNumber')
                : t('fields.passportNumber')
            }
            optionalLabel={t('optional')}
          >
            <IdentityDocumentInput
              error={Boolean(errors[`${partyPrefix}-identityDocument`])}
              id={`${partyPrefix}-identityDocument`}
              maskedValue={party.identityDocumentMasked}
              onChange={(identityDocument) =>
                update({ identityDocument } as Partial<typeof party>)
              }
              placeholder={t('fields.identityPlaceholder')}
              type={party.identityDocumentType}
              value={
                (party as typeof party & { identityDocument?: string })
                  .identityDocument ?? ''
              }
            />
          </FormField>
        )}
      </div>
      <div className="mt-5">
        <div className="mb-3 text-xs font-bold text-[#2E286C]/55">
          {t('fields.partyRoles')}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['guardian', 'payer', 'promissory_debtor', 'other'] as const).map(
            (role) => (
              <label
                key={role}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                  party.roles.includes(role)
                    ? 'border-[#533089]/30 bg-[#533089]/7 text-[#533089]'
                    : 'border-black/[0.06] text-[#2E286C]/45'
                }`}
              >
                <input
                  type="checkbox"
                  checked={party.roles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="accent-[#533089]"
                />
                {t(`partyRoles.${role}`)}
              </label>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function ProgramStep({
  catalog,
  draft,
  errors,
  setDraft,
  t,
}: {
  catalog: ProgramManagementData;
  draft: DraftState;
  errors: EnrollmentFieldErrors;
  setDraft: SetDraft;
  t: WizardT;
}) {
  const locale = useLocale();
  const selectedProgram = catalog.programs.find(
    (program) => program.id === draft.programReferenceId,
  );
  const availableBranches = selectedProgram
    ? catalog.branches.filter(
        (branch) => branch.programId === selectedProgram.id,
      )
    : [];
  const selectedBranch = catalog.branches.find(
    (branch) => branch.id === draft.branchId,
  );
  const branchAtCapacity = selectedBranch
    ? selectedBranch.currentEnrollmentCount >= selectedBranch.maximumCapacity
    : false;
  const privateRates = draft.privateLessonLanguage
    ? catalog.rates.filter(
        (rate) => rate.language === draft.privateLessonLanguage,
      )
    : [];
  const selectedRate = catalog.rates.find(
    (rate) =>
      rate.instructorProfileId === draft.selectedInstructorProfileId &&
      rate.language === draft.privateLessonLanguage,
  );

  function chooseProgram(programId: string) {
    const program = catalog.programs.find((item) => item.id === programId);
    if (!program) return;

    setDraft((current) => ({
      ...current,
      branchId: undefined,
      branchName: undefined,
      capacityOverride: false,
      capacityOverrideNote: undefined,
      courseMode: program.kind,
      discountCents: 0,
      discountNote: undefined,
      discountType: 'none',
      discountValue: 0,
      finalPriceCents:
        program.kind === 'group' ? program.listPriceCents : undefined,
      listPriceCents:
        program.kind === 'group' ? program.listPriceCents : undefined,
      privateLessonHours: undefined,
      privateLessonLanguage: undefined,
      privateLessonRateId: undefined,
      programLabel:
        program.systemKey === 'private-lesson'
          ? t('options.private')
          : program.name,
      programReferenceId: program.id,
      selectedInstructorProfileId: undefined,
    }));
  }

  function updatePrivateSelection(values: Partial<DraftState>) {
    setDraft((current) => {
      const next = { ...current, ...values };
      const rate = catalog.rates.find(
        (item) =>
          item.instructorProfileId === next.selectedInstructorProfileId &&
          item.language === next.privateLessonLanguage,
      );
      const basePrice =
        rate && next.privateLessonHours
          ? rate.hourlyPriceCents * next.privateLessonHours
          : undefined;

      return {
        ...next,
        discountCents: 0,
        discountNote: undefined,
        discountType: 'none',
        discountValue: 0,
        finalPriceCents: basePrice,
        listPriceCents: basePrice,
        privateLessonRateId: rate?.id,
      };
    });
  }

  return (
    <div className="space-y-6">
      <SelectField
        error={errors.programReferenceId}
        id="programReferenceId"
        label={t('fields.program')}
        required
        value={draft.programReferenceId ?? ''}
        onChange={chooseProgram}
        options={[
          ['', t('select')],
          ...catalog.programs.map(
            (program) =>
              [
                program.id,
                program.systemKey === 'private-lesson'
                  ? t('options.private')
                  : program.name,
              ] as const,
          ),
        ]}
      />

      {selectedProgram?.kind === 'group' && (
        <div className="space-y-5">
          <div className="grid gap-4 rounded-2xl bg-[#F8F7FB] p-5 sm:grid-cols-3">
            <ProgramSummary
              label={t('fields.language')}
              value={
                selectedProgram.language
                  ? t(`languages.${selectedProgram.language}`)
                  : '-'
              }
            />
            <ProgramSummary
              label={t('fields.levels')}
              value={selectedProgram.levels.join(' · ')}
            />
            <ProgramSummary
              label={t('fields.listPrice')}
              value={formatTry(selectedProgram.listPriceCents ?? 0, locale)}
            />
          </div>

          {availableBranches.length ? (
            <>
              <SelectField
                error={errors.branchId}
                id="branchId"
                label={t('fields.branch')}
                required
                value={draft.branchId ?? ''}
                onChange={(branchId) => {
                  const branch = catalog.branches.find(
                    (item) => item.id === branchId,
                  );
                  setDraft((current) => ({
                    ...current,
                    branchId: branch?.id,
                    branchName: branch?.name,
                    capacityOverride: false,
                    capacityOverrideNote: undefined,
                  }));
                }}
                options={[
                  ['', t('select')],
                  ...availableBranches.map(
                    (branch) =>
                      [
                        branch.id,
                        `${branch.name} · ${branch.currentEnrollmentCount}/${branch.maximumCapacity}`,
                      ] as const,
                  ),
                ]}
              />

              {selectedBranch && (
                <div className="grid gap-4 rounded-2xl border border-black/[0.05] bg-white p-5 sm:grid-cols-3">
                  <ProgramSummary
                    label={t('fields.branchDates')}
                    value={`${formatDate(selectedBranch.plannedStartDate, locale)} – ${formatDate(selectedBranch.plannedEndDate, locale)}`}
                  />
                  <ProgramSummary
                    label={t('fields.capacity')}
                    value={`${selectedBranch.currentEnrollmentCount} / ${selectedBranch.maximumCapacity}`}
                  />
                  <ProgramSummary
                    label={t('fields.teacher')}
                    value={
                      selectedBranch.instructorName ??
                      t('teacherAssignmentPending')
                    }
                  />
                </div>
              )}

              {branchAtCapacity && (
                <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-semibold leading-6 text-amber-800">
                    {t('branchCapacityWarning')}
                  </p>
                  <label className="flex items-start gap-3 text-sm font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={draft.capacityOverride}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          capacityOverride: event.target.checked,
                          capacityOverrideNote: event.target.checked
                            ? current.capacityOverrideNote
                            : undefined,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 accent-[#533089]"
                    />
                    {t('capacityOverrideApproval')}
                  </label>
                  {draft.capacityOverride && (
                    <Field
                      label={t('fields.capacityOverrideNote')}
                      value={draft.capacityOverrideNote ?? ''}
                      onChange={(capacityOverrideNote) =>
                        setDraft((current) => ({
                          ...current,
                          capacityOverrideNote,
                        }))
                      }
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
              {t('noOpenBranch')}
            </div>
          )}
        </div>
      )}

      {selectedProgram?.kind === 'private' && (
        <div className="space-y-5 rounded-2xl border border-[#533089]/10 bg-[#533089]/[0.025] p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              error={errors.privateLesson}
              id="privateLessonLanguage"
              label={t('fields.privateLessonLanguage')}
              required
              value={draft.privateLessonLanguage ?? ''}
              onChange={(value) =>
                updatePrivateSelection({
                  privateLessonLanguage: value as ProgramLanguage,
                  selectedInstructorProfileId: undefined,
                })
              }
              options={[
                ['', t('select')],
                ...(['english', 'german', 'french', 'arabic'] as const).map(
                  (language) =>
                    [language, t(`languages.${language}`)] as const,
                ),
              ]}
            />
            <SelectField
              error={errors.privateLesson}
              id="selectedInstructorProfileId"
              label={t('fields.teacher')}
              required
              value={draft.selectedInstructorProfileId ?? ''}
              onChange={(value) =>
                updatePrivateSelection({ selectedInstructorProfileId: value })
              }
              options={[
                ['', t('select')],
                ...privateRates.map(
                  (rate) =>
                    [rate.instructorProfileId, rate.instructorName] as const,
                ),
              ]}
            />
            <Field
              error={errors.privateLesson}
              id="privateLessonHours"
              label={t('fields.privateLessonHours')}
              required
              type="number"
              value={String(draft.privateLessonHours ?? '')}
              onChange={(value) =>
                updatePrivateSelection({
                  privateLessonHours: Math.max(1, Number(value) || 1),
                })
              }
            />
            <div className="rounded-xl bg-white p-4">
              <div className="text-xs font-bold text-[#2E286C]/45">
                {t('fields.hourlyStudentPrice')}
              </div>
              <div className="mt-2 text-lg font-bold text-[#533089]">
                {selectedRate
                  ? formatTry(selectedRate.hourlyPriceCents, locale)
                  : '-'}
              </div>
            </div>
          </div>
          {!privateRates.length && draft.privateLessonLanguage && (
            <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-700">
              {t('noPrivateLessonRate')}
            </div>
          )}
          {draft.listPriceCents !== undefined && (
            <div className="flex items-center justify-between rounded-xl bg-[#533089] p-4 text-white">
              <span className="text-sm font-semibold">
                {t('privateLessonTotal')}
              </span>
              <span className="text-lg font-bold">
                {formatTry(draft.listPriceCents, locale)}
              </span>
            </div>
          )}
          <p className="text-xs font-medium leading-5 text-[#2E286C]/45">
            {t('privateLessonRateNote')}
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t('fields.instagram')}
          value={draft.instagramHandle ?? ''}
          onChange={(value) =>
            setDraft((current) => ({ ...current, instagramHandle: value }))
          }
          placeholder="@"
        />
        <div className="rounded-2xl bg-blue-50 p-4 text-sm font-medium leading-6 text-blue-700">
          {t('programModuleNote')}
        </div>
      </div>
    </div>
  );
}

function ProgramSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-[#2E286C]">{value}</div>
    </div>
  );
}

function SourceStep({
  draft,
  errors,
  originalSource,
  setDraft,
  t,
}: {
  draft: DraftState;
  errors: EnrollmentFieldErrors;
  originalSource?: string;
  setDraft: SetDraft;
  t: WizardT;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#F8F7FB] p-5">
        <div className="text-xs font-bold text-[#2E286C]/45">
          {t('fields.originalSource')}
        </div>
        <div className="mt-2 text-sm font-bold text-[#2E286C]">
          {originalSource ?? t('unknown')}
        </div>
        <p className="mt-2 text-xs leading-5 text-[#2E286C]/45">
          {t('originalSourceHelp')}
        </p>
      </div>
      <SelectField
        error={errors.correctedSource}
        id="correctedSource"
        label={t('fields.correctedSource')}
        optionalLabel={t('optional')}
        value={draft.correctedSource ?? ''}
        onChange={(correctedSource) =>
          setDraft((current) => ({
            ...current,
            correctedSource,
            correctedSourceDetail:
              correctedSource === 'other'
                ? current.correctedSourceDetail
                : undefined,
          }))
        }
        options={[
          ['', t('select')],
          ['instagram', t('sourceOptions.instagram')],
          ['google', t('sourceOptions.google')],
          ['referral', t('sourceOptions.referral')],
          ['web_level_test', t('sourceOptions.webLevelTest')],
          ['whatsapp', t('sourceOptions.whatsapp')],
          ['other', t('options.other')],
        ]}
      />
      {draft.correctedSource === 'other' && (
        <Field
          error={errors.correctedSourceDetail}
          id="correctedSourceDetail"
          label={t('fields.correctedSourceDetail')}
          required
          value={draft.correctedSourceDetail ?? ''}
          onChange={(correctedSourceDetail) =>
            setDraft((current) => ({
              ...current,
              correctedSourceDetail,
            }))
          }
        />
      )}
    </div>
  );
}

function ChannelStep({
  draft,
  errors,
  setDraft,
  t,
}: {
  draft: DraftState;
  errors: EnrollmentFieldErrors;
  setDraft: SetDraft;
  t: WizardT;
}) {
  return (
    <SelectField
      error={errors.registrationChannel}
      id="registrationChannel"
      label={t('fields.registrationChannel')}
      required
      value={draft.registrationChannel ?? ''}
      onChange={(value) =>
        setDraft((current) => ({ ...current, registrationChannel: value }))
      }
      options={[
        ['', t('select')],
        ['web', t('options.web')],
        ['phone', t('options.phone')],
        ['whatsapp', t('options.whatsapp')],
        ['video_call', t('options.videoCall')],
        ['other', t('options.other')],
      ]}
    />
  );
}

function DocumentsStep({
  busy,
  documentType,
  documents,
  onRemove,
  onUpload,
  setDocumentType,
  t,
}: {
  busy: boolean;
  documentType: 'contract' | 'identity' | 'other' | 'passport' | 'receipt';
  documents: EnrollmentDraftView['documents'];
  onRemove: (documentId: string) => Promise<void>;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  setDocumentType: (
    value: 'contract' | 'identity' | 'other' | 'passport' | 'receipt',
  ) => void;
  t: WizardT;
}) {
  return (
    <div className="space-y-5">
      <SelectField
        label={t('fields.documentType')}
        value={documentType}
        onChange={(value) =>
          setDocumentType(
            value as
              | 'contract'
              | 'identity'
              | 'other'
              | 'passport'
              | 'receipt',
          )
        }
        options={[
          ['identity', t('documentTypes.identity')],
          ['passport', t('documentTypes.passport')],
          ['receipt', t('documentTypes.receipt')],
          ['contract', t('documentTypes.contract')],
          ['other', t('documentTypes.other')],
        ]}
      />
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#533089]/25 bg-[#533089]/[0.025] text-center">
        <FileUp className="h-7 w-7 text-[#533089]" />
        <span className="mt-3 text-sm font-bold text-[#2E286C]">
          {t('uploadDocument')}
        </span>
        <span className="mt-1 text-xs font-medium text-[#2E286C]/40">
          {t('documentFormats')}
        </span>
        <input
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,application/pdf"
          disabled={busy}
          onChange={onUpload}
        />
      </label>
      <div className="space-y-3">
        {documents.map((document) => (
          <div
            key={document.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-black/[0.05] p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-[#2E286C]">
                {document.label}
              </div>
              <div className="mt-1 text-xs font-medium text-[#2E286C]/40">
                {t(`documentTypes.${document.type}`)} ·{' '}
                {t(`documentStatuses.${document.status}`)}
              </div>
            </div>
            <button
              type="button"
              aria-label={t('removeDocument')}
              onClick={() => onRemove(document.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceStep({
  draft,
  errors,
  setDraft,
  t,
}: {
  draft: DraftState;
  errors: EnrollmentFieldErrors;
  setDraft: SetDraft;
  t: WizardT;
}) {
  function updateDiscount(
    discountType: DraftState['discountType'],
    discountValue: number,
  ) {
    setDraft((current) =>
      applyDiscount(current, discountType, discountValue),
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <MoneyField
        label={t('fields.listPrice')}
        cents={draft.listPriceCents}
        disabled
        onChange={() => undefined}
      />
      <SelectField
        label={t('fields.discountType')}
        value={draft.discountType}
        onChange={(value) =>
          updateDiscount(
            value as DraftState['discountType'],
            value === 'none' ? 0 : draft.discountValue,
          )
        }
        options={[
          ['none', t('options.discountNone')],
          ['percentage', t('options.discountPercentage')],
          ['fixed', t('options.discountFixed')],
        ]}
      />
      {draft.discountType === 'percentage' && (
        <Field
          label={t('fields.discountPercentage')}
          type="number"
          value={(draft.discountValue / 100).toString()}
          onChange={(value) =>
            updateDiscount(
              'percentage',
              Math.min(10_000, Math.max(0, Math.round(Number(value) * 100))),
            )
          }
        />
      )}
      {draft.discountType === 'fixed' && (
        <MoneyField
          label={t('fields.discountAmount')}
          cents={draft.discountValue}
          onChange={(value) => updateDiscount('fixed', value)}
        />
      )}
      <MoneyField
        label={t('fields.finalPrice')}
        cents={draft.finalPriceCents}
        disabled
        onChange={() => undefined}
      />
      <MoneyField
        error={errors.initialPaymentCents}
        id="initialPaymentCents"
        label={t('fields.initialPayment')}
        required
        cents={draft.initialPaymentCents}
        onChange={(value) =>
          setDraft((current) => ({ ...current, initialPaymentCents: value }))
        }
      />
      <Field
        label={t('fields.installmentCount')}
        type="number"
        value={String(draft.installmentCount)}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            installmentCount: Math.max(1, Number(value) || 1),
          }))
        }
      />
      <SelectField
        label={t('fields.paymentMethod')}
        value={draft.paymentMethod ?? ''}
        onChange={(value) =>
          setDraft((current) => ({ ...current, paymentMethod: value }))
        }
        options={[
          ['', t('select')],
          ['cash', t('options.cash')],
          ['bank_transfer', t('options.bankTransfer')],
          ['credit_card', t('options.creditCard')],
          ['promissory_note', t('options.promissoryNote')],
          ['mixed', t('options.mixed')],
        ]}
      />
      {draft.discountType !== 'none' && (
        <div className="sm:col-span-2">
          <TextAreaField
            label={t('fields.discountNote')}
            value={draft.discountNote ?? ''}
            onChange={(value) =>
              setDraft((current) => ({ ...current, discountNote: value }))
            }
            placeholder={t('fields.discountNotePlaceholder')}
          />
        </div>
      )}
      <div className="sm:col-span-2">
        <TextAreaField
          label={t('fields.financialNotes')}
          value={draft.financialNotes ?? ''}
          onChange={(value) =>
            setDraft((current) => ({ ...current, financialNotes: value }))
          }
        />
      </div>
    </div>
  );
}

function ScheduleStep({
  catalog,
  draft,
  setDraft,
  t,
}: {
  catalog: ProgramManagementData;
  draft: DraftState;
  setDraft: SetDraft;
  t: WizardT;
}) {
  const locale = useLocale();
  const selectedBranch = catalog.branches.find(
    (branch) => branch.id === draft.branchId,
  );
  const branchSchedule = selectedBranch?.lessonSchedule;

  if (draft.courseMode === 'group') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#533089]/10 bg-[#F8F7FB] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/35">
                {t('fields.branchSchedule')}
              </div>
              <h3 className="mt-2 text-lg font-bold text-[#2E286C]">
                {selectedBranch?.name ?? draft.branchName ?? t('fields.branch')}
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[#2E286C]/55">
                {t('branchScheduleInherited')}
              </p>
            </div>
            {branchSchedule?.sessions.length ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  window.open(
                    buildSchedulePrintUrl(draft.id, selectedBranch?.id),
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                <Printer className="h-4 w-4" />
                {t('printSchedule')}
              </Button>
            ) : null}
          </div>

          {branchSchedule?.sessions.length ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {branchSchedule.sessions.slice(0, 12).map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#2E286C]"
                >
                  {formatDate(session.date, locale)} · {session.startTime}
                </div>
              ))}
              {branchSchedule.sessions.length > 12 && (
                <div className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#533089]">
                  {t('moreLessons', {
                    count: branchSchedule.sessions.length - 12,
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              {t('branchScheduleMissing')}
            </div>
          )}
        </div>
        <TextAreaField
          label={t('fields.scheduleNotes')}
          value={draft.scheduleNotes ?? ''}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              scheduleMode: 'inherited',
              scheduleNotes: value,
            }))
          }
          placeholder={t('fields.schedulePlaceholder')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SelectField
        label={t('fields.scheduleMode')}
        value={draft.scheduleMode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            scheduleMode: value as DraftState['scheduleMode'],
          }))
        }
        options={[
          ['pending', t('options.schedulePending')],
          ['inherited', t('options.scheduleInherited')],
          ['custom', t('options.scheduleCustom')],
        ]}
      />
      <TextAreaField
        label={t('fields.scheduleNotes')}
        value={draft.scheduleNotes ?? ''}
        onChange={(value) =>
          setDraft((current) => ({ ...current, scheduleNotes: value }))
        }
        placeholder={t('fields.schedulePlaceholder')}
      />
    </div>
  );
}

function buildSchedulePrintUrl(draftId: string, branchId?: string) {
  const url = new URL('/api/admin/enrollment-drafts/schedule-print', window.location.origin);
  url.searchParams.set('draftId', draftId);
  if (branchId) url.searchParams.set('branchId', branchId);
  return url.toString();
}

function ReviewStep({
  confirmationPassword,
  documents,
  draft,
  isMinor,
  onIssueClick,
  parties,
  setConfirmationPassword,
  setDraft,
  t,
}: {
  confirmationPassword: string;
  documents: EnrollmentDraftView['documents'];
  draft: DraftState;
  isMinor: boolean;
  onIssueClick: (issue: string, step?: number) => void;
  parties: EnrollmentDraftView['parties'];
  setConfirmationPassword: (value: string) => void;
  setDraft: SetDraft;
  t: WizardT;
}) {
  const messages = validationMessages(t);
  const issues = [1, 2, 3, 4, 5, 7].flatMap((reviewStep) =>
    Object.entries(
      validateCurrentStep(reviewStep, draft, parties, isMinor, t),
    ).map(([field, message]) => ({
      field,
      message,
      step: reviewStep,
    })),
  );
  const checks = [
    {
      complete: !Object.keys(
        validateEnrollmentStep(1, draft, parties, isMinor, messages),
      ).length,
      label: t('checks.identity'),
      step: 1,
    },
    {
      complete: !Object.keys(
        validateEnrollmentStep(2, draft, parties, isMinor, messages),
      ).length,
      label: t('checks.contact'),
      step: 2,
    },
    {
      complete:
        !isMinor ||
        parties.some((party) => party.roles.includes('guardian')),
      label: t('checks.guardian'),
      step: 2,
    },
    {
      complete: !Object.keys(
        validateEnrollmentStep(3, draft, parties, isMinor, messages),
      ).length,
      label: t('checks.program'),
      step: 3,
    },
    {
      complete: !Object.keys(
        validateEnrollmentStep(7, draft, parties, isMinor, messages),
      ).length,
      label: t('checks.finance'),
      step: 7,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map(({ complete, label, step: checkStep }) => (
          <button
            type="button"
            key={`${checkStep}-${label}`}
            onClick={() => {
              const issue = issues.find((item) => item.step === checkStep);
              if (!complete && issue) onIssueClick(issue.field, issue.step);
            }}
            className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-bold ${
              complete
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-left text-amber-700 hover:bg-amber-100'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
              {complete ? <Check className="h-4 w-4" /> : '!'}
            </span>
            {label}
          </button>
        ))}
      </div>
      {issues.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-bold text-amber-900">
            {t('reviewIssuesTitle')}
          </div>
          <div className="mt-3 space-y-2">
            {issues.map((issue) => (
              <button
                key={`${issue.step}-${issue.field}`}
                type="button"
                onClick={() => onIssueClick(issue.field, issue.step)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                <span>{issue.message}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-[#F8F7FB] p-5 text-sm text-[#2E286C]/60">
        {t('reviewSummary', {
          documents: documents.length,
          parties: parties.length,
        })}
      </div>
      <TextAreaField
        label={t('fields.internalNotes')}
        value={draft.internalNotes ?? ''}
        onChange={(value) =>
          setDraft((current) => ({ ...current, internalNotes: value }))
        }
      />
      <Field
        label={t('fields.confirmationPassword')}
        type="password"
        value={confirmationPassword}
        onChange={setConfirmationPassword}
        placeholder={t('fields.confirmationPasswordPlaceholder')}
      />
    </div>
  );
}

function Field({
  disabled,
  error,
  id,
  label,
  onChange,
  optionalLabel,
  placeholder,
  required,
  type = 'text',
  value,
}: {
  disabled?: boolean;
  error?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  optionalLabel?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <FormField
      error={error}
      htmlFor={id}
      label={label}
      optionalLabel={optionalLabel}
      required={required}
    >
      <Input
        id={id}
        disabled={disabled}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`h-12 ${error ? 'border-red-400 focus:border-red-500' : ''}`}
      />
    </FormField>
  );
}

function MoneyField({
  cents,
  disabled,
  error,
  id,
  label,
  onChange,
  required,
}: {
  cents?: number;
  disabled?: boolean;
  error?: string;
  id?: string;
  label: string;
  onChange: (value: number) => void;
  required?: boolean;
}) {
  return (
    <FormField error={error} htmlFor={id} label={label} required={required}>
      <div className="relative">
        <Input
          id={id}
          disabled={disabled}
          type="number"
          min="0"
          step="0.01"
          value={cents === undefined ? '' : (cents / 100).toFixed(2)}
          onChange={(event) =>
            onChange(Math.round((Number(event.target.value) || 0) * 100))
          }
          className={`h-12 pr-16 ${error ? 'border-red-400 focus:border-red-500' : ''}`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#533089]">
          TRY
        </span>
      </div>
    </FormField>
  );
}

function SelectField({
  error,
  id,
  label,
  onChange,
  optionalLabel,
  options,
  required,
  value,
}: {
  error?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  optionalLabel?: string;
  options: Array<readonly [string, string]>;
  required?: boolean;
  value: string;
}) {
  return (
    <FormField
      error={error}
      htmlFor={id}
      label={label}
      optionalLabel={optionalLabel}
      required={required}
    >
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-12 w-full rounded-xl border bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none focus:border-[#533089]/30 ${
          error ? 'border-red-400' : 'border-transparent'
        }`}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function TextAreaField({
  error,
  id,
  label,
  onChange,
  optionalLabel,
  placeholder,
  required,
  value,
}: {
  error?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  optionalLabel?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <FormField
      error={error}
      htmlFor={id}
      label={label}
      optionalLabel={optionalLabel}
      required={required}
    >
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={`w-full rounded-xl border bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none placeholder:text-[#2E286C]/35 focus:border-[#533089]/30 ${
          error ? 'border-red-400' : 'border-transparent'
        }`}
      />
    </FormField>
  );
}

function buildPatch(
  step: number,
  draft: DraftState,
  parties: EnrollmentDraftView['parties'],
): EnrollmentDraftPatch {
  if (step === 1) {
    return {
      data: {
        birthAdministrativeArea: draft.birthAdministrativeArea ?? '',
        birthCountryCode: draft.birthCountryCode ?? 'TR',
        birthDate: draft.birthDate ?? '',
        birthLocality: draft.birthLocality ?? '',
        firstName: draft.firstName,
        gender: draft.gender || undefined,
        identityDocument: draft.identityDocument,
        identityDocumentType: draft.identityDocumentType ?? 'national_id',
        lastName: draft.lastName,
        school: draft.school ?? '',
      },
      step: 1,
    };
  }
  if (step === 2) {
    return {
      data: {
        email: draft.email,
        parties: parties.map((party) => ({
          email: party.email,
          fullName: party.fullName,
          id: party.id,
          identityDocument: (
            party as typeof party & { identityDocument?: string }
          ).identityDocument,
          identityDocumentType: party.identityDocumentType,
          phone: party.phone,
          relationship: party.relationship,
          relationshipOther: party.relationshipOther,
          roles: party.roles,
        })),
        primaryPhone: draft.primaryPhone,
        residenceAddress: draft.residenceAddress,
        secondaryPhone: draft.secondaryPhone,
        studentIsContractParty: draft.studentIsContractParty,
        username: draft.studentUsername ?? '',
      },
      step: 2,
    };
  }
  if (step === 3) {
    return {
      data: {
        branchId: draft.branchId,
        capacityOverride: draft.capacityOverride,
        capacityOverrideNote: draft.capacityOverrideNote,
        instagramHandle: draft.instagramHandle,
        privateLessonHours: draft.privateLessonHours,
        privateLessonLanguage: draft.privateLessonLanguage,
        programId: draft.programReferenceId ?? '',
        instructorProfileId: draft.selectedInstructorProfileId,
      },
      step: 3,
    };
  }
  if (step === 4) {
    return {
      data: {
        correctedSource: draft.correctedSource,
        correctedSourceDetail: draft.correctedSourceDetail,
      },
      step: 4,
    };
  }
  if (step === 5) {
    return {
      data: { registrationChannel: draft.registrationChannel ?? '' },
      step: 5,
    };
  }
  if (step === 6) {
    return { data: {}, step: 6 };
  }
  if (step === 7) {
    return {
      data: {
        discountNote: draft.discountNote,
        discountType: draft.discountType,
        discountValue: draft.discountValue,
        financialNotes: draft.financialNotes,
        initialPaymentCents: draft.initialPaymentCents,
        installmentCount: draft.installmentCount,
        paymentMethod: draft.paymentMethod,
      },
      step: 7,
    };
  }
  if (step === 8) {
    return {
      data: {
        scheduleMode: draft.scheduleMode,
        scheduleNotes: draft.scheduleNotes,
        schedulePreferences: draft.schedulePreferences,
      },
      step: 8,
    };
  }
  return { data: { internalNotes: draft.internalNotes }, step: 9 };
}

function canAutosaveStep(
  step: number,
  draft: DraftState,
  parties: EnrollmentDraftView['parties'],
  isMinor: boolean,
  catalog: ProgramManagementData,
) {
  if (step === 1) {
    return Boolean(
      draft.firstName.trim().length >= 2 &&
        draft.lastName.trim().length >= 2 &&
        !Object.keys(
          validateEnrollmentStep(
            1,
            draft,
            parties,
            isMinor,
            emptyValidationMessages(),
          ),
        ).length,
    );
  }

  if (step === 2) {
    const partiesValid = parties.every(
      (party) =>
        party.fullName.trim().length >= 2 &&
        party.roles.length > 0 &&
        (party.relationship !== 'other' ||
          Boolean(party.relationshipOther?.trim())),
    );
    const guardianValid =
      !isMinor || parties.some((party) => party.roles.includes('guardian'));
    return Boolean(
      draft.email.includes('@') &&
        !Object.keys(
          validateEnrollmentStep(
            2,
            draft,
            parties,
            isMinor,
            {
              address: '',
              birthDate: '',
              birthLocation: '',
              branch: '',
              email: '',
              firstName: '',
              gender: '',
              guardian: '',
              identity: '',
              initialPayment: '',
              lastName: '',
              phone: '',
              privateLesson: '',
              program: '',
              registrationChannel: '',
              school: '',
              username: '',
            },
          ),
        ).length &&
        draft.residenceAddress.trim().length >= 8 &&
        partiesValid &&
        guardianValid,
    );
  }

  if (step === 3) {
    if (!draft.courseMode || !draft.programReferenceId) return false;
    if (draft.courseMode === 'group') {
      const branch = catalog.branches.find(
        (item) => item.id === draft.branchId,
      );
      if (!branch) return false;
      const atCapacity =
        branch.currentEnrollmentCount >= branch.maximumCapacity;
      return !atCapacity || draft.capacityOverride;
    }
    return Boolean(
      draft.privateLessonLanguage &&
        draft.selectedInstructorProfileId &&
        draft.privateLessonHours &&
        draft.privateLessonRateId,
    );
  }

  if (step === 5) {
    return Boolean(draft.registrationChannel);
  }

  if (step === 7) {
    return Boolean(
      draft.listPriceCents !== undefined &&
        draft.finalPriceCents !== undefined &&
        draft.finalPriceCents ===
          draft.listPriceCents - draft.discountCents &&
        draft.initialPaymentCents <= draft.finalPriceCents,
    );
  }

  return true;
}

function validationMessages(t: WizardT) {
  return {
    address: t('fieldErrors.address'),
    birthDate: t('fieldErrors.birthDate'),
    birthLocation: t('fieldErrors.birthLocation'),
    branch: t('fieldErrors.branch'),
    email: t('fieldErrors.email'),
    firstName: t('fieldErrors.firstName'),
    gender: t('fieldErrors.gender'),
    guardian: t('fieldErrors.guardian'),
    identity: t('fieldErrors.identity'),
    initialPayment: t('fieldErrors.initialPayment'),
    lastName: t('fieldErrors.lastName'),
    phone: t('fieldErrors.phone'),
    privateLesson: t('fieldErrors.privateLesson'),
    program: t('fieldErrors.program'),
    registrationChannel: t('fieldErrors.registrationChannel'),
    school: t('fieldErrors.school'),
    username: t('fieldErrors.username'),
  };
}

function enrollmentApiFieldErrors(code: string, t: WizardT) {
  const errors: EnrollmentFieldErrors = {};

  if (
    code === 'username_already_registered' ||
    code === 'invitation_username_already_pending'
  ) {
    errors.studentUsername =
      code === 'username_already_registered'
        ? t('fieldErrors.usernameTaken')
        : t('fieldErrors.usernamePending');
    return errors;
  }

  if (
    code === 'invitation_email_already_registered' ||
    code === 'invitation_already_pending'
  ) {
    errors.email =
      code === 'invitation_email_already_registered'
        ? t('fieldErrors.emailTaken')
        : t('fieldErrors.emailPending');
    return errors;
  }

  return errors;
}

function emptyValidationMessages() {
  return {
    address: '',
    birthDate: '',
    birthLocation: '',
    branch: '',
    email: '',
    firstName: '',
    gender: '',
    guardian: '',
    identity: '',
    initialPayment: '',
    lastName: '',
    phone: '',
    privateLesson: '',
    program: '',
    registrationChannel: '',
    school: '',
    username: '',
  };
}

function validateCurrentStep(
  step: number,
  draft: DraftState,
  parties: EnrollmentDraftView['parties'],
  isMinor: boolean,
  t: WizardT,
) {
  const errors = validateEnrollmentStep(
    step,
    draft,
    parties,
    isMinor,
    validationMessages(t),
  );

  if (step === 2) {
    for (const party of parties) {
      const prefix = `party-${party.id}`;
      if (party.fullName.trim().length < 2) {
        errors[`${prefix}-fullName`] = t('fieldErrors.partyName');
      }
      if (
        party.relationship === 'other' &&
        !party.relationshipOther?.trim()
      ) {
        errors[`${prefix}-relationshipOther`] = t(
          'fieldErrors.relationshipOther',
        );
      }
      if (party.phone && !/^\+\d{7,15}$/.test(party.phone)) {
        errors[`${prefix}-phone`] = t('fieldErrors.phone');
      }
      if (
        party.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email)
      ) {
        errors[`${prefix}-email`] = t('fieldErrors.email');
      }
      if (!party.roles.length) {
        errors[`${prefix}-relationship`] = t('fieldErrors.partyRole');
      }
    }
  }

  if (
    step === 4 &&
    draft.correctedSource === 'other' &&
    !draft.correctedSourceDetail?.trim()
  ) {
    errors.correctedSourceDetail = t('fieldErrors.sourceDetail');
  }

  return errors;
}

function focusField(fieldId?: string) {
  if (!fieldId) return;
  window.setTimeout(() => {
    const element = document.getElementById(fieldId);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}

function applyDiscount(
  draft: DraftState,
  discountType: DraftState['discountType'],
  rawValue: number,
): DraftState {
  const listPriceCents = draft.listPriceCents ?? 0;
  const value = Math.max(0, Math.trunc(rawValue));
  const discountValue =
    discountType === 'percentage'
      ? Math.min(10_000, value)
      : discountType === 'fixed'
        ? Math.min(listPriceCents, value)
        : 0;
  const discountCents =
    discountType === 'percentage'
      ? Math.round((listPriceCents * discountValue) / 10_000)
      : discountType === 'fixed'
        ? discountValue
        : 0;

  return {
    ...draft,
    discountCents,
    discountNote:
      discountType === 'none' ? undefined : draft.discountNote,
    discountType,
    discountValue,
    finalPriceCents: listPriceCents - discountCents,
  };
}

function formatTry(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'TRY',
    style: 'currency',
  }).format(cents / 100);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}

function enrollmentIssueStep(issue: string) {
  if (
    [
      'identity',
      'first_name',
      'last_name',
      'birth_date',
      'birth_country',
      'birth_administrative_area',
      'birth_locality',
      'birth_place',
      'gender',
      'school',
    ].includes(issue)
  ) {
    return 1;
  }

  if (
    [
      'phone',
      'email',
      'student_username',
      'address',
      'contract_party',
      'guardian',
    ].includes(issue)
  ) {
    return 2;
  }

  if (
    [
      'course_mode',
      'program_id',
      'program',
      'program_branch',
      'private_lesson_selection',
    ].includes(issue)
  ) {
    return 3;
  }

  if (issue === 'registration_channel') {
    return 5;
  }

  if (['financial_plan', 'financial_totals'].includes(issue)) {
    return 7;
  }

  return 1;
}

function enrollmentIssueField(issue: string) {
  const fields: Record<string, string> = {
    address: 'residenceAddress',
    birth_administrative_area: 'birthAdministrativeArea',
    birth_country: 'birthCountryCode',
    birth_date: 'birthDate',
    birth_locality: 'birthLocality',
    birth_place: 'birthAdministrativeArea',
    contract_party: 'primaryPhone',
    course_mode: 'programReferenceId',
    email: 'email',
    financial_plan: 'initialPaymentCents',
    financial_totals: 'initialPaymentCents',
    first_name: 'firstName',
    gender: 'gender',
    guardian: 'primaryPhone',
    identity: 'identityDocument',
    last_name: 'lastName',
    phone: 'primaryPhone',
    private_lesson_selection: 'privateLessonLanguage',
    program: 'programReferenceId',
    program_branch: 'branchId',
    program_id: 'programReferenceId',
    registration_channel: 'registrationChannel',
    school: 'school',
    student_username: 'studentUsername',
  };
  return fields[issue] ?? issue;
}
