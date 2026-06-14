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
  Plus,
  Save,
  Trash2,
  UserRoundCheck,
} from 'lucide-react';
import {
  ActionBar,
  Button,
  Input,
  ModulePanel,
  PageHeader,
  StatusChip,
} from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
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
  const [draft, setDraft] = useState<DraftState>({
    ...initial.draft,
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
  const [lastSavedAt, setLastSavedAt] = useState(initial.draft.lastSavedAt);
  const isCompleted = initial.draft.status === 'completed';
  const progress = Math.round((step / stepNumbers.length) * 100);
  const autosaveSignature = useMemo(
    () => JSON.stringify(buildPatch(step, draft, parties)),
    [draft, parties, step],
  );

  const birthDateIsMinor = useMemo(() => {
    if (!draft.birthDate) return false;
    const birthDate = new Date(`${draft.birthDate}T12:00:00Z`);
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const month = today.getUTCMonth() - birthDate.getUTCMonth();
    if (
      month < 0 ||
      (month === 0 && today.getUTCDate() < birthDate.getUTCDate())
    ) {
      age -= 1;
    }
    return age < 18;
  }, [draft.birthDate]);

  useEffect(() => {
    if (
      isCompleted ||
      !canAutosaveStep(step, draft, parties, birthDateIsMinor)
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
    draft.id,
    draft,
    isCompleted,
    parties,
    step,
  ]);

  async function saveCurrentStep(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setMessage('');

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
        throw new Error(body.error ?? 'save_failed');
      }
      setLastSavedAt(body.savedAt);
      if (body.draft) {
        setDraft((current) => ({ ...current, ...body.draft }));
      }
      setMessage(t('saved'));
      if (step < 9) {
        setStep((current) => current + 1);
      }
    } catch {
      setMessage(t('saveError'));
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
          body: JSON.stringify({ password: confirmationPassword }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? 'complete_failed');
      }
      setMessage(t('completed'));
      router.push('/admin/leads');
      router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMessage(
        code.startsWith('enrollment_incomplete:')
          ? t('incomplete')
          : t('completeError'),
      );
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
                onClick={() => setStep(number)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-bold transition-colors ${
                  step === number
                    ? 'bg-[#533089] text-white'
                    : number < step
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-[#2E286C]/55 hover:bg-black/[0.03]'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current/20">
                  {number < step ? <Check className="h-3.5 w-3.5" /> : number}
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
              <IdentityStep draft={draft} setDraft={setDraft} t={t} />
            )}
            {step === 2 && (
              <ContactStep
                draft={draft}
                isMinor={birthDateIsMinor}
                parties={parties}
                setDraft={setDraft}
                setParties={setParties}
                t={t}
              />
            )}
            {step === 3 && (
              <ProgramStep
                catalog={catalog}
                draft={draft}
                setDraft={setDraft}
                t={t}
              />
            )}
            {step === 4 && (
              <SourceStep
                draft={draft}
                originalSource={initial.candidate.originalSource}
                setDraft={setDraft}
                t={t}
              />
            )}
            {step === 5 && (
              <ChannelStep draft={draft} setDraft={setDraft} t={t} />
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
              <FinanceStep draft={draft} setDraft={setDraft} t={t} />
            )}
            {step === 8 && (
              <ScheduleStep draft={draft} setDraft={setDraft} t={t} />
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
                    {busy ? t('saving') : t('saveAndContinue')}
                    {busy ? <Save className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
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
  setDraft,
  t,
}: {
  draft: DraftState;
  setDraft: SetDraft;
  t: WizardT;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SelectField
        label={t('fields.identityType')}
        value={draft.identityDocumentType ?? 'national_id'}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            identityDocument: '',
            identityDocumentType: value as 'national_id' | 'passport',
          }))
        }
        options={[
          ['national_id', t('options.nationalId')],
          ['passport', t('options.passport')],
        ]}
      />
      <Field
        label={
          draft.identityDocumentMasked
            ? `${t('fields.identityNumber')} (${draft.identityDocumentMasked})`
            : t('fields.identityNumber')
        }
        value={draft.identityDocument}
        onChange={(value) =>
          setDraft((current) => ({ ...current, identityDocument: value }))
        }
        placeholder={
          draft.identityDocumentMasked
            ? t('fields.leaveBlankToKeep')
            : t('fields.identityPlaceholder')
        }
      />
      <Field
        label={t('fields.firstName')}
        value={draft.firstName}
        onChange={(value) =>
          setDraft((current) => ({ ...current, firstName: value }))
        }
      />
      <Field
        label={t('fields.lastName')}
        value={draft.lastName}
        onChange={(value) =>
          setDraft((current) => ({ ...current, lastName: value }))
        }
      />
      <Field
        label={t('fields.birthPlace')}
        value={draft.birthPlace ?? ''}
        onChange={(value) =>
          setDraft((current) => ({ ...current, birthPlace: value }))
        }
      />
      <Field
        label={t('fields.birthDate')}
        type="date"
        value={draft.birthDate ?? ''}
        onChange={(value) =>
          setDraft((current) => ({ ...current, birthDate: value }))
        }
      />
      <SelectField
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
  isMinor,
  parties,
  setDraft,
  setParties,
  t,
}: {
  draft: DraftState;
  isMinor: boolean;
  parties: EnrollmentDraftView['parties'];
  setDraft: SetDraft;
  setParties: React.Dispatch<
    React.SetStateAction<EnrollmentDraftView['parties']>
  >;
  t: WizardT;
}) {
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
        <Field
          label={t('fields.primaryPhone')}
          value={draft.primaryPhone}
          onChange={(value) =>
            setDraft((current) => ({ ...current, primaryPhone: value }))
          }
        />
        <Field
          label={t('fields.secondaryPhone')}
          value={draft.secondaryPhone ?? ''}
          onChange={(value) =>
            setDraft((current) => ({ ...current, secondaryPhone: value }))
          }
        />
        <Field
          label={t('fields.email')}
          type="email"
          value={draft.email}
          onChange={(value) =>
            setDraft((current) => ({ ...current, email: value }))
          }
        />
        <div className="sm:col-span-2">
          <TextAreaField
            label={t('fields.address')}
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
  index,
  party,
  setParties,
  t,
}: {
  index: number;
  party: EnrollmentDraftView['parties'][number];
  setParties: React.Dispatch<
    React.SetStateAction<EnrollmentDraftView['parties']>
  >;
  t: WizardT;
}) {
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
          label={t('fields.fullName')}
          value={party.fullName}
          onChange={(value) => update({ fullName: value })}
        />
        <SelectField
          label={t('fields.relationship')}
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
            label={t('fields.relationshipOther')}
            value={party.relationshipOther ?? ''}
            onChange={(value) => update({ relationshipOther: value })}
          />
        )}
        <Field
          label={t('fields.phone')}
          value={party.phone ?? ''}
          onChange={(value) => update({ phone: value })}
        />
        <Field
          label={t('fields.email')}
          type="email"
          value={party.email ?? ''}
          onChange={(value) => update({ email: value })}
        />
        <SelectField
          label={t('fields.identityType')}
          value={party.identityDocumentType ?? ''}
          onChange={(value) =>
            update({
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
        <Field
          label={
            party.identityDocumentMasked
              ? `${t('fields.identityNumber')} (${party.identityDocumentMasked})`
              : t('fields.identityNumber')
          }
          value={
            (party as typeof party & { identityDocument?: string })
              .identityDocument ?? ''
          }
          onChange={(value) =>
            update({ identityDocument: value } as Partial<typeof party>)
          }
          placeholder={
            party.identityDocumentMasked
              ? t('fields.leaveBlankToKeep')
              : undefined
          }
        />
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
  setDraft,
  t,
}: {
  catalog: ProgramManagementData;
  draft: DraftState;
  setDraft: SetDraft;
  t: WizardT;
}) {
  const locale = useLocale();
  const selectedProgram = catalog.programs.find(
    (program) => program.id === draft.programReferenceId,
  );
  const privateRates = draft.privateLessonLanguage
    ? catalog.rates.filter(
        (rate) => rate.language === draft.privateLessonLanguage,
      )
    : [];
  const selectedRate = catalog.rates.find(
    (rate) =>
      rate.teacherUserId === draft.selectedTeacherUserId &&
      rate.language === draft.privateLessonLanguage,
  );

  function chooseProgram(programId: string) {
    const program = catalog.programs.find((item) => item.id === programId);
    if (!program) return;

    setDraft((current) => ({
      ...current,
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
      selectedTeacherUserId: undefined,
    }));
  }

  function updatePrivateSelection(values: Partial<DraftState>) {
    setDraft((current) => {
      const next = { ...current, ...values };
      const rate = catalog.rates.find(
        (item) =>
          item.teacherUserId === next.selectedTeacherUserId &&
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
        label={t('fields.program')}
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
      )}

      {selectedProgram?.kind === 'private' && (
        <div className="space-y-5 rounded-2xl border border-[#533089]/10 bg-[#533089]/[0.025] p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label={t('fields.privateLessonLanguage')}
              value={draft.privateLessonLanguage ?? ''}
              onChange={(value) =>
                updatePrivateSelection({
                  privateLessonLanguage: value as ProgramLanguage,
                  selectedTeacherUserId: undefined,
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
              label={t('fields.teacher')}
              value={draft.selectedTeacherUserId ?? ''}
              onChange={(value) =>
                updatePrivateSelection({ selectedTeacherUserId: value })
              }
              options={[
                ['', t('select')],
                ...privateRates.map(
                  (rate) => [rate.teacherUserId, rate.teacherName] as const,
                ),
              ]}
            />
            <Field
              label={t('fields.privateLessonHours')}
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
  originalSource,
  setDraft,
  t,
}: {
  draft: DraftState;
  originalSource?: string;
  setDraft: SetDraft;
  t: WizardT;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        disabled
        label={t('fields.originalSource')}
        value={originalSource ?? t('unknown')}
        onChange={() => undefined}
      />
      <Field
        label={t('fields.correctedSource')}
        value={draft.correctedSource ?? ''}
        onChange={(value) =>
          setDraft((current) => ({ ...current, correctedSource: value }))
        }
        placeholder={t('fields.correctedSourcePlaceholder')}
      />
    </div>
  );
}

function ChannelStep({
  draft,
  setDraft,
  t,
}: {
  draft: DraftState;
  setDraft: SetDraft;
  t: WizardT;
}) {
  return (
    <SelectField
      label={t('fields.registrationChannel')}
      value={draft.registrationChannel ?? ''}
      onChange={(value) =>
        setDraft((current) => ({ ...current, registrationChannel: value }))
      }
      options={[
        ['', t('select')],
        ['office', t('options.office')],
        ['phone', t('options.phone')],
        ['online', t('options.online')],
        ['event', t('options.event')],
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
            <div>
              <div className="text-sm font-bold text-[#2E286C]">
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
              className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
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
  setDraft,
  t,
}: {
  draft: DraftState;
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
        label={t('fields.initialPayment')}
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
  draft,
  setDraft,
  t,
}: {
  draft: DraftState;
  setDraft: SetDraft;
  t: WizardT;
}) {
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

function ReviewStep({
  confirmationPassword,
  documents,
  draft,
  isMinor,
  parties,
  setConfirmationPassword,
  setDraft,
  t,
}: {
  confirmationPassword: string;
  documents: EnrollmentDraftView['documents'];
  draft: DraftState;
  isMinor: boolean;
  parties: EnrollmentDraftView['parties'];
  setConfirmationPassword: (value: string) => void;
  setDraft: SetDraft;
  t: WizardT;
}) {
  const checks = [
    [Boolean(draft.identityDocumentMasked || draft.identityDocument), t('checks.identity')],
    [Boolean(draft.primaryPhone && draft.email && draft.residenceAddress), t('checks.contact')],
    [!isMinor || parties.some((party) => party.roles.includes('guardian')), t('checks.guardian')],
    [Boolean(draft.courseMode), t('checks.program')],
    [draft.finalPriceCents !== undefined, t('checks.finance')],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map(([complete, label]) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-bold ${
              complete
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
              {complete ? <Check className="h-4 w-4" /> : '!'}
            </span>
            {label}
          </div>
        ))}
      </div>
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
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold text-[#2E286C]/60">{label}</span>
      <Input
        disabled={disabled}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12"
      />
    </label>
  );
}

function MoneyField({
  cents,
  disabled,
  label,
  onChange,
}: {
  cents?: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold text-[#2E286C]/60">{label}</span>
      <div className="relative">
        <Input
          disabled={disabled}
          type="number"
          min="0"
          step="0.01"
          value={cents === undefined ? '' : (cents / 100).toFixed(2)}
          onChange={(event) =>
            onChange(Math.round((Number(event.target.value) || 0) * 100))
          }
          className="h-12 pr-16"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#533089]">
          TRY
        </span>
      </div>
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<readonly [string, string]>;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold text-[#2E286C]/60">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 text-sm font-medium text-[#2E286C] outline-none focus:border-[#533089]/30"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold text-[#2E286C]/60">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-transparent bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none placeholder:text-[#2E286C]/35 focus:border-[#533089]/30"
      />
    </label>
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
        birthDate: draft.birthDate ?? '',
        birthPlace: draft.birthPlace ?? '',
        firstName: draft.firstName,
        gender: draft.gender ?? 'prefer_not_to_say',
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
      },
      step: 2,
    };
  }
  if (step === 3) {
    return {
      data: {
        instagramHandle: draft.instagramHandle,
        privateLessonHours: draft.privateLessonHours,
        privateLessonLanguage: draft.privateLessonLanguage,
        programId: draft.programReferenceId ?? '',
        teacherUserId: draft.selectedTeacherUserId,
      },
      step: 3,
    };
  }
  if (step === 4) {
    return { data: { correctedSource: draft.correctedSource }, step: 4 };
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
) {
  if (step === 1) {
    return Boolean(
      draft.birthDate &&
        draft.birthPlace &&
        draft.firstName &&
        draft.gender &&
        (draft.identityDocument || draft.identityDocumentMasked) &&
        draft.lastName &&
        draft.school,
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
        draft.primaryPhone.replace(/\D/g, '').length >= 7 &&
        draft.residenceAddress.trim().length >= 8 &&
        partiesValid &&
        guardianValid,
    );
  }

  if (step === 3) {
    if (!draft.courseMode || !draft.programReferenceId) return false;
    if (draft.courseMode === 'group') return true;
    return Boolean(
      draft.privateLessonLanguage &&
        draft.selectedTeacherUserId &&
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
