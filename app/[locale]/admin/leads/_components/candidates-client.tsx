'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardPenLine,
  Clock3,
  Mail,
  Phone,
  Search,
  UserRound,
} from 'lucide-react';
import {
  EmptyState,
  Button,
  FilterTabs,
  InfoField,
  ListItemCard,
  ModulePanel,
  PageHeader,
  ResponsiveTabs,
  SearchInput,
  StatusChip,
  TimelineItem,
} from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { AppointmentPanel } from './appointment-panel';
import type { CandidateDirectoryRecord } from '@/lib/server/services/candidate-directory';
import type { AdvisorOption } from '@/lib/server/services/candidate-pipeline';

const STAGES = [
  'new',
  'contacted',
  'qualified',
  'offer_pending',
  'enrolled',
  'lost',
] as const;

type CandidateFilter =
  | 'all'
  | 'appointment'
  | 'level'
  | 'mine'
  | 'missing'
  | 'not_started';

export function CandidatesClient({
  advisors,
  basePath = '/admin/leads',
  candidates,
  currentUserId,
}: {
  advisors: AdvisorOption[];
  basePath?: string;
  candidates: CandidateDirectoryRecord[];
  currentUserId?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('admin.leads');
  const [filter, setFilter] = useState<CandidateFilter>('all');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);

    return candidates.filter((candidate) => {
      const matchesQuery =
        !normalizedQuery ||
        `${candidate.fullName} ${candidate.email} ${candidate.phone ?? ''}`
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'mine' && candidate.advisorId === currentUserId) ||
        (filter === 'missing' && !candidate.communicationComplete) ||
        (filter === 'not_started' &&
          candidate.assessmentStatus === 'not_started') ||
        (filter === 'level' &&
          candidate.assessmentStatus === 'completed') ||
        (filter === 'appointment' &&
          candidate.appointmentStatus === 'requested');
      return matchesQuery && matchesFilter;
    });
  }, [candidates, currentUserId, filter, locale, query]);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id);
  const selected =
    visible.find((candidate) => candidate.id === selectedId) ??
    visible[0] ??
    null;

  const list = (
    <ModulePanel padded={false} className="flex min-h-[36rem] w-full flex-col overflow-hidden rounded-3xl lg:w-[22rem] lg:shrink-0">
      <div className="space-y-4 border-b border-black/[0.03] p-5">
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search')}
        />
        <FilterTabs
          activeValue={filter}
          onChange={(value) => setFilter(value as CandidateFilter)}
          items={[
            { label: t('all'), value: 'all' },
            ...(currentUserId
              ? [{ label: t('assignedToMe'), value: 'mine' }]
              : []),
            { label: t('missingContact'), value: 'missing' },
            { label: t('notStarted'), value: 'not_started' },
            { label: t('levelDetermined'), value: 'level' },
            { label: t('appointmentRequested'), value: 'appointment' },
          ]}
        />
      </div>

      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-3">
        {visible.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => setSelectedId(candidate.id)}
            className="block w-full text-left"
          >
            <ListItemCard active={candidate.id === selected?.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[#2E286C]">
                    {candidate.fullName}
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#2E286C]/45">
                    {languageLabel(candidate.language, locale)}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#2E286C]/35">
                  {formatRelative(candidate.lastActivityMinutesAgo, locale)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!candidate.communicationComplete && (
                  <StatusChip tone="amber">{t('missingContact')}</StatusChip>
                )}
                <AssessmentChip candidate={candidate} t={t} />
                {candidate.appointmentStatus === 'requested' && (
                  <StatusChip tone="purple">{t('appointmentRequested')}</StatusChip>
                )}
              </div>
            </ListItemCard>
          </button>
        ))}

        {!visible.length && (
          <div className="flex min-h-72 items-center justify-center px-5 text-center text-sm font-semibold text-[#2E286C]/40">
            {t('noCandidates')}
          </div>
        )}
      </div>
    </ModulePanel>
  );

  const profile = selected ? (
    <CandidateProfile
      advisors={advisors}
      basePath={basePath}
      candidate={selected}
      locale={locale}
      t={t}
    />
  ) : (
    <EmptyState
      className="min-h-[36rem] flex-1"
      icon={Search}
      title={t('noCandidates')}
      description={t('noCandidatesDescription')}
    />
  );

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="lg:hidden">
        <ResponsiveTabs
          defaultValue="list"
          items={[
            { content: list, label: t('title'), value: 'list' },
            { content: profile, label: t('profile'), value: 'profile' },
          ]}
        />
      </div>

      <div className="hidden min-h-[calc(100dvh-12rem)] gap-6 lg:flex">
        {list}
        {profile}
      </div>
    </div>
  );
}

function CandidateProfile({
  advisors,
  basePath,
  candidate,
  locale,
  t,
}: {
  advisors: AdvisorOption[];
  basePath: string;
  candidate: CandidateDirectoryRecord;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const [startingEnrollment, setStartingEnrollment] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [actionError, setActionError] = useState('');

  async function patchCandidate(payload: {
    advisorId?: string | null;
    stage?: string;
  }) {
    setActionError('');
    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      });
      if (!response.ok) {
        setActionError(t('updateError'));
        return;
      }
      router.refresh();
    } catch {
      setActionError(t('updateError'));
    }
  }

  async function submitNote() {
    const body = noteBody.trim();
    if (!body || savingNote) return;
    setSavingNote(true);
    setActionError('');
    try {
      const response = await fetch(
        `/api/admin/candidates/${candidate.id}/notes`,
        {
          body: JSON.stringify({ body }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('note_failed');
      setNoteBody('');
      router.refresh();
    } catch {
      setActionError(t('noteError'));
    } finally {
      setSavingNote(false);
    }
  }

  async function startEnrollment() {
    setStartingEnrollment(true);
    setEnrollmentError(false);

    try {
      const response = await fetch(
        `/api/admin/candidates/${candidate.id}/enrollment-draft`,
        { credentials: 'same-origin', method: 'POST' },
      );
      if (!response.ok) {
        throw new Error('enrollment_start_failed');
      }
      router.push(`${basePath}/${candidate.id}/enrollment`);
    } catch {
      setEnrollmentError(true);
      setStartingEnrollment(false);
    }
  }

  return (
    <div className="grid min-w-0 flex-1 gap-5 xl:grid-cols-[1fr_19rem]">
      <ModulePanel className="rounded-3xl">
        <div className="flex flex-col justify-between gap-5 border-b border-black/[0.04] pb-6 sm:flex-row sm:items-start">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#533089]/8 text-lg font-bold text-[#533089]">
              {initials(candidate.fullName)}
            </div>
            <div>
              <h2 className="text-2xl font-medium text-[#2E286C]">
                {candidate.fullName}
              </h2>
              <p className="mt-1 text-sm font-medium text-[#2E286C]/45">
                {t('applicationCount', { count: candidate.applicationCount })}
              </p>
            </div>
          </div>
          <select
            value={candidate.stage}
            onChange={(event) => patchCandidate({ stage: event.target.value })}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold text-[#533089] outline-none focus:border-[#533089]/40"
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel(stage, t)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 border-b border-black/[0.04] py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold text-[#2E286C]">
              {candidate.stage === 'enrolled'
                ? t('enrollmentCompleted')
                : candidate.activeEnrollmentDraft
                  ? t('enrollmentInProgress')
                  : t('enrollmentReady')}
            </div>
            <div className="mt-1 text-xs font-medium text-[#2E286C]/45">
              {candidate.stage === 'enrolled'
                ? t('enrollmentCompletedDescription')
                : t('enrollmentActionDescription')}
            </div>
          </div>
          {candidate.stage !== 'enrolled' && (
            <Button
              size="sm"
              disabled={startingEnrollment}
              onClick={startEnrollment}
            >
              <ClipboardPenLine className="h-4 w-4" />
              {startingEnrollment
                ? t('enrollmentOpening')
                : candidate.activeEnrollmentDraft
                  ? t('continueEnrollment')
                  : t('startEnrollment')}
            </Button>
          )}
        </div>
        {enrollmentError && (
          <p className="mt-3 text-xs font-semibold text-red-600">
            {t('enrollmentStartError')}
          </p>
        )}

        <div className="grid gap-4 py-6 sm:grid-cols-2">
          <ContactRow icon={Mail} label={t('email')} value={candidate.email} />
          <ContactRow
            icon={Phone}
            label={t('phone')}
            value={candidate.phone ?? t('missingContact')}
            muted={!candidate.phone}
          />
        </div>

        <div className="grid gap-4 border-t border-black/[0.04] pt-6 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            icon={candidate.assessmentStatus === 'completed' ? CheckCircle2 : Clock3}
            label={t('assessment')}
            value={
              candidate.resultLevel
                ? `${candidate.resultLevel} · ${candidate.score ?? 0}%`
                : assessmentLabel(candidate.assessmentStatus, t)
            }
          />
          <Metric
            icon={CalendarClock}
            label={t('appointmentLabel')}
            value={
              candidate.appointmentStatus === 'requested'
                ? t('appointmentRequested')
                : t('noAppointment')
            }
          />
          <div className="rounded-2xl border border-black/[0.03] p-4">
            <UserRound className="h-5 w-5 text-[#533089]" />
            <div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">
              {t('assignedAdvisor')}
            </div>
            <select
              value={candidate.advisorId ?? ''}
              onChange={(event) =>
                patchCandidate({ advisorId: event.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm font-bold text-[#2E286C] outline-none focus:border-[#533089]/40"
            >
              <option value="">{t('noAdvisor')}</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-[#F8F7FB] p-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {t('latestApplication')}
          </h3>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <InfoField
              label={t('language')}
              value={languageLabel(candidate.language, locale)}
            />
            <InfoField label={t('source')} value={sourceLabel(candidate.source, t)} />
            <InfoField label={t('locale')} value={(candidate.locale ?? '-').toUpperCase()} />
            <InfoField
              label={t('learningGoal')}
              value={learningGoalLabel(candidate.learningGoal, t)}
            />
            <InfoField
              label={t('preferredContact')}
              value={candidate.preferredContactChannel ?? '-'}
            />
            <InfoField
              label={t('lessonModel')}
              value={lessonModelLabel(candidate.lessonModel, t)}
            />
            <InfoField label={t('city')} value={candidate.city ?? '-'} />
            <InfoField
              label={t('contactWindow')}
              value={candidate.contactWindow ?? '-'}
            />
            <InfoField
              label={t('lastActivity')}
              value={new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Europe/Istanbul',
              }).format(new Date(candidate.lastActivityAt))}
            />
          </div>
        </div>

        {candidate.appointmentStatus && (
          <AppointmentPanel
            candidateId={candidate.id}
            locale={locale}
            status={candidate.appointmentStatus}
            preferences={candidate.appointmentPreferences}
            scheduledStartsAt={candidate.appointmentStartsAt}
            outcomeNote={candidate.appointmentOutcomeNote}
          />
        )}

        {(candidate.referrer ||
          (candidate.attribution &&
            Object.keys(candidate.attribution).length > 0)) && (
          <div className="mt-6 rounded-3xl bg-[#F8F7FB] p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
              {t('attribution')}
            </h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {candidate.attribution &&
                Object.entries(candidate.attribution).map(([key, value]) => (
                  <InfoField key={key} label={key} value={String(value)} valueClassName="break-all" />
                ))}
              {candidate.referrer && (
                <InfoField label={t('referrer')} value={candidate.referrer} valueClassName="break-all" />
              )}
            </div>
          </div>
        )}

        {candidate.consents.length > 0 && (
          <div className="mt-6 rounded-3xl bg-[#F8F7FB] p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
              {t('consents')}
            </h3>
            <div className="mt-4 space-y-3">
              {candidate.consents.map((consent, index) => (
                <div
                  key={`${consent.type}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4"
                >
                  <div>
                    <div className="text-sm font-bold text-[#2E286C]">
                      {consentTypeLabel(consent.type, t)}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#2E286C]/45">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Europe/Istanbul',
                      }).format(new Date(consent.acceptedAt))}{' '}
                      · v{consent.version} · {consent.locale.toUpperCase()}
                    </div>
                  </div>
                  <StatusChip tone={consent.accepted ? 'emerald' : 'gray'}>
                    {consent.accepted
                      ? t('consentAccepted')
                      : t('consentDeclined')}
                  </StatusChip>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-black/[0.04] pt-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {t('timeline')}
          </h3>
          <div className="mt-5 space-y-3">
            {candidate.activities.map((activity) => (
              <TimelineItem
                key={`${activity.type}-${activity.occurredAt}`}
                title={activityLabel(activity.type, t)}
                time={new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(activity.occurredAt))}
                tone={activityTone(activity.type)}
              />
            ))}
            {!candidate.activities.length && (
              <p className="text-sm font-medium text-[#2E286C]/40">
                {t('noTimeline')}
              </p>
            )}
          </div>
        </div>
      </ModulePanel>

      <div className="space-y-5">
        <ModulePanel className="rounded-3xl">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {t('dataQuality')}
          </h3>
          <div className="mt-5 space-y-3">
            <QualityRow complete label={t('emailCaptured')} />
            <QualityRow complete={candidate.communicationComplete} label={t('phoneCaptured')} />
            <QualityRow complete={candidate.assessmentStatus === 'completed'} label={t('assessmentCompleted')} />
          </div>
        </ModulePanel>

        <ModulePanel className="rounded-3xl">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {t('statusSummary')}
          </h3>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusChip tone={candidate.communicationComplete ? 'emerald' : 'amber'}>
              {candidate.communicationComplete ? t('contactCaptured') : t('missingContact')}
            </StatusChip>
            <AssessmentChip candidate={candidate} t={t} />
            {candidate.appointmentStatus === 'requested' && (
              <StatusChip tone="purple">{t('appointmentRequested')}</StatusChip>
            )}
          </div>
        </ModulePanel>

        <ModulePanel className="rounded-3xl">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {t('notes')}
          </h3>
          <div className="mt-4 space-y-3">
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder={t('notePlaceholder')}
              maxLength={2000}
              className="min-h-20 w-full resize-y rounded-2xl border border-black/[0.06] bg-[#F8F7FB] px-4 py-3 text-sm text-[#2E286C] outline-none focus:border-[#533089]/30"
            />
            {actionError && (
              <p className="text-xs font-semibold text-[#B42318]">
                {actionError}
              </p>
            )}
            <Button
              size="sm"
              onClick={submitNote}
              disabled={savingNote || !noteBody.trim()}
            >
              {savingNote ? t('noteSaving') : t('addNote')}
            </Button>
            <div className="space-y-3 pt-1">
              {candidate.notes.map((note) => (
                <div key={note.id} className="rounded-2xl bg-[#F8F7FB] p-3">
                  <p className="whitespace-pre-wrap text-sm text-[#2E286C]/80">
                    {note.body}
                  </p>
                  <p className="mt-1.5 text-[10px] font-semibold text-[#2E286C]/35">
                    {note.authorName ?? '—'} ·{' '}
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Europe/Istanbul',
                    }).format(new Date(note.createdAt))}
                  </p>
                </div>
              ))}
              {!candidate.notes.length && (
                <p className="text-sm font-medium text-[#2E286C]/40">
                  {t('noNotes')}
                </p>
              )}
            </div>
          </div>
        </ModulePanel>
      </div>
    </div>
  );
}

function AssessmentChip({
  candidate,
  t,
}: {
  candidate: CandidateDirectoryRecord;
  t: ReturnType<typeof useTranslations>;
}) {
  const tone =
    candidate.assessmentStatus === 'completed'
      ? 'emerald'
      : candidate.assessmentStatus === 'in_progress'
        ? 'blue'
        : 'gray';
  return (
    <StatusChip tone={tone}>
      {assessmentLabel(candidate.assessmentStatus, t)}
    </StatusChip>
  );
}

function ContactRow({
  icon: Icon,
  label,
  muted,
  value,
}: {
  icon: typeof Mail;
  label: string;
  muted?: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/[0.03] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#533089]/7 text-[#533089]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">{label}</div>
        <div className={`mt-1 truncate text-sm font-bold ${muted ? 'text-amber-600' : 'text-[#2E286C]'}`}>{value}</div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.03] p-4">
      <Icon className="h-5 w-5 text-[#533089]" />
      <div className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/35">{label}</div>
      <div className="mt-1 text-sm font-bold text-[#2E286C]">{value}</div>
    </div>
  );
}

function QualityRow({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-[#2E286C]/65">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${complete ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
        {complete ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
      </span>
      {label}
    </div>
  );
}

function assessmentLabel(
  status: CandidateDirectoryRecord['assessmentStatus'],
  t: ReturnType<typeof useTranslations>,
) {
  if (status === 'completed') return t('levelDetermined');
  if (status === 'in_progress') return t('assessmentInProgress');
  return t('notStarted');
}

function stageLabel(stage: string, t: ReturnType<typeof useTranslations>) {
  const supported = ['new', 'contacted', 'qualified', 'offer_pending', 'enrolled', 'lost'];
  return supported.includes(stage) ? t(`stages.${stage}`) : stage;
}

function sourceLabel(source: string | undefined, t: ReturnType<typeof useTranslations>) {
  return source === 'public_level_test' ? t('publicLevelTest') : source ?? '-';
}

function lessonModelLabel(
  model: string | undefined,
  t: ReturnType<typeof useTranslations>,
) {
  const supported = ['one_to_one', 'group', 'undecided'];
  if (!model) return '-';
  return supported.includes(model) ? t(`lessonModels.${model}`) : model;
}

function learningGoalLabel(
  goal: string | undefined | null,
  t: ReturnType<typeof useTranslations>,
) {
  const supported = [
    'daily_life',
    'career',
    'academic',
    'exam',
    'travel',
    'other',
  ];
  if (!goal) return '-';
  return supported.includes(goal) ? t(`goals.${goal}`) : goal;
}

function consentTypeLabel(
  type: string,
  t: ReturnType<typeof useTranslations>,
) {
  const supported = ['candidate_notice', 'marketing_email'];
  return supported.includes(type) ? t(`consentTypes.${type}`) : type;
}

function activityLabel(
  type: string,
  t: ReturnType<typeof useTranslations>,
) {
  const supported = [
    'candidate.created_from_public_assessment',
    'candidate.inquiry_received',
    'candidate.assessment_completed',
    'candidate.profile_completed',
    'candidate.appointment_requested',
    'candidate.appointment_scheduled',
    'candidate.appointment_resolved',
    'candidate.advisor_assigned',
    'candidate.stage_changed',
    'candidate.note_added',
    'candidate.enrollment_started',
    'candidate.enrollment_completed',
  ];
  return supported.includes(type)
    ? t(`activities.${type.replace('candidate.', '')}`)
    : type;
}

function activityTone(type: string) {
  if (type.includes('completed')) return 'emerald' as const;
  if (type.includes('appointment')) return 'blue' as const;
  if (type.includes('enrollment_started')) return 'amber' as const;
  return 'brand' as const;
}

function languageLabel(language: string | undefined, locale: string) {
  if (!language) return '-';
  const labels: Record<string, Record<string, string>> = {
    arabic: { en: 'Arabic', tr: 'Arapça' },
    english: { en: 'English', tr: 'İngilizce' },
    french: { en: 'French', tr: 'Fransızca' },
    german: { en: 'German', tr: 'Almanca' },
  };
  return labels[language]?.[locale] ?? language;
}

function formatRelative(minutes: number, locale: string) {
  if (minutes < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -Math.max(1, minutes),
      'minute',
    );
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      -hours,
      'hour',
    );
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    -Math.floor(hours / 24),
    'day',
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
