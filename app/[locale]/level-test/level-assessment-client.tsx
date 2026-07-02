'use client';

import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  Button,
  DateTimePicker,
  Input,
  LanguageSwitcher,
} from '@/components/ui';

type Locale = 'en' | 'tr';

type AssessmentState = {
  appointment?: {
    preferences: string[];
    status: string;
    timezone: string;
  };
  candidate: {
    firstName: string;
    language: string;
  };
  expiresAt: string;
  question?: {
    difficulty: number;
    id: string;
    level: string;
    options: Array<{ id: string; label: string }>;
    order: number;
    prompt: string;
    topic: string;
  };
  result?: {
    correctCount: number;
    level: string;
    score: number;
    totalQuestions: number;
  };
  resultReady: boolean;
  stage: 'assessment' | 'profile' | 'result';
  totalQuestions: number;
};

type ApiResult = {
  error?: string;
  state?: AssessmentState | null;
};

const fieldClass =
  'h-12 rounded-2xl border border-[#2E286C]/10 bg-white px-4 text-sm font-semibold text-[#2E286C] outline-none transition focus:border-[#533089]/40 focus:ring-4 focus:ring-[#533089]/5';

export function LevelAssessmentClient() {
  const locale = useLocale() as Locale;
  const t = useTranslations('publicAssessment');
  const formStartedAt = useRef(Date.now());
  const [state, setState] = useState<AssessmentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch(`/api/public/assessment?locale=${locale}`, {
      credentials: 'same-origin',
    })
      .then((response) => response.json() as Promise<ApiResult>)
      .then((result) => {
        if (active) setState(result.state ?? null);
      })
      .catch(() => {
        if (active) setError(t('genericError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale, t]);

  async function submit(
    endpoint: string,
    body: Record<string, unknown>,
    method = 'POST',
  ) {
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method,
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.state) {
        setError(
          result.error === 'assessment_session_expired'
            ? t('expired')
            : t('genericError'),
        );
        return null;
      }

      setState(result.state);
      return result.state;
    } catch {
      setError(t('genericError'));
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function restart() {
    setSubmitting(true);
    setError('');

    try {
      await fetch('/api/public/assessment', {
        credentials: 'same-origin',
        method: 'DELETE',
      });
      formStartedAt.current = Date.now();
      setState(null);
    } catch {
      setError(t('genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  const stage = state?.stage ?? 'start';
  const stepIndex =
    stage === 'start' ? 0 : stage === 'assessment' ? 1 : stage === 'profile' ? 2 : 3;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#F5F2FA] px-4 py-5 sm:px-6 lg:py-8">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-[#8C6CE6]/10 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-[#533089]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4 pb-5 lg:pb-7">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/80 px-4 text-xs font-bold uppercase tracking-wider text-[#2E286C]/65 shadow-sm transition hover:text-[#533089]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('backHome')}</span>
          </Link>

          <Link href="/" className="font-rosmatika text-2xl font-bold text-[#2E286C]">
            Zümra
          </Link>
          <LanguageSwitcher />
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:gap-7">
          <aside className="relative overflow-hidden rounded-[2rem] bg-[#2E286C] p-6 text-white shadow-2xl shadow-[#2E286C]/15 sm:p-8 lg:p-10">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[32px] border-white/5" />
            <div className="relative flex h-full flex-col">
              <div className="mb-10 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                <Sparkles className="h-4 w-4" />
                {t('eyebrow')}
              </div>
              <h1 className="max-w-lg text-4xl font-medium leading-[1.05] sm:text-5xl lg:text-6xl">
                {t('title')}
              </h1>
              <p className="mt-5 max-w-md text-sm font-medium leading-7 text-white/65 sm:text-base">
                {t('description')}
              </p>

              <div className="mt-auto hidden pt-10 lg:block">
                <StepList activeIndex={stepIndex} t={t} />
              </div>
            </div>
          </aside>

          <div className="flex min-h-[38rem] flex-col rounded-[2rem] border border-white bg-white/85 p-5 shadow-2xl shadow-[#2E286C]/10 backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="mb-6 lg:hidden">
              <StepList activeIndex={stepIndex} compact t={t} />
            </div>

            {loading ? (
              <div className="flex flex-1 items-center justify-center text-sm font-semibold text-[#2E286C]/50">
                <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-[#533089]/20 border-t-[#533089]" />
                {t('loading')}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${stage}-${state?.question?.id ?? 'base'}`}
                  initial={{ opacity: 0, y: 18, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.99 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-1 flex-col"
                >
                  {!state ? (
                    <StartForm
                      formStartedAt={formStartedAt.current}
                      locale={locale}
                      onSubmit={(body) =>
                        submit('/api/public/assessment', body)
                      }
                      submitting={submitting}
                      t={t}
                    />
                  ) : state.stage === 'assessment' && state.question ? (
                    <QuestionView
                      locale={locale}
                      onSubmit={(body) =>
                        submit('/api/public/assessment/answer', body)
                      }
                      state={state}
                      submitting={submitting}
                      t={t}
                    />
                  ) : state.stage === 'profile' ? (
                    <ProfileForm
                      locale={locale}
                      onSubmit={(body) =>
                        submit('/api/public/assessment/profile', body)
                      }
                      submitting={submitting}
                      t={t}
                    />
                  ) : state.result ? (
                    <ResultView
                      locale={locale}
                      onAppointment={(body) =>
                        submit('/api/public/assessment/appointment', body)
                      }
                      onRestart={restart}
                      state={state}
                      submitting={submitting}
                      t={t}
                    />
                  ) : null}
                </motion.div>
              </AnimatePresence>
            )}

            {error && (
              <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StepList({
  activeIndex,
  compact = false,
  t,
}: {
  activeIndex: number;
  compact?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const steps = ['start', 'assessment', 'profile', 'result'] as const;

  return (
    <div className={compact ? 'grid grid-cols-4 gap-2' : 'space-y-4'}>
      {steps.map((step, index) => {
        const active = index === activeIndex;
        const complete = index < activeIndex;

        return (
          <div
            key={step}
            className={compact ? 'text-center' : 'flex items-center gap-4'}
          >
            <div
              className={`mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                active || complete
                  ? compact
                    ? 'border-[#533089] bg-[#533089] text-white'
                    : 'border-white bg-white text-[#2E286C]'
                  : compact
                    ? 'border-[#2E286C]/10 text-[#2E286C]/35'
                    : 'border-white/15 text-white/35'
              }`}
            >
              {complete ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={`${compact ? 'mt-1 block break-words px-0.5 text-[9px] leading-tight' : 'text-xs'} font-bold uppercase tracking-wider ${
                active || complete
                  ? compact
                    ? 'text-[#2E286C]'
                    : 'text-white'
                  : compact
                    ? 'text-[#2E286C]/30'
                    : 'text-white/35'
              }`}
            >
              {t(`steps.${step}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StartForm({
  formStartedAt,
  locale,
  onSubmit,
  submitting,
  t,
}: {
  formStartedAt: number;
  locale: Locale;
  onSubmit: (body: Record<string, unknown>) => Promise<AssessmentState | null>;
  submitting: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [consent, setConsent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const attribution = Object.fromEntries(
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
        .map((key) => [key, new URLSearchParams(window.location.search).get(key)])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );

    void onSubmit({
      attribution,
      email: form.get('email'),
      firstName: form.get('firstName'),
      formStartedAt,
      idempotencyKey: crypto.randomUUID(),
      language: form.get('language'),
      lastName: form.get('lastName'),
      locale,
      marketingConsent: form.get('marketingConsent') === 'on',
      referrer: document.referrer || undefined,
      website: form.get('website'),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <div>
        <h2 className="text-3xl font-medium text-[#2E286C] sm:text-4xl">
          {t('start.title')}
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[#2E286C]/55">
          {t('start.description')}
        </p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <Field label={t('start.firstName')}>
          <Input name="firstName" required autoComplete="given-name" className={fieldClass} />
        </Field>
        <Field label={t('start.lastName')}>
          <Input name="lastName" required autoComplete="family-name" className={fieldClass} />
        </Field>
        <Field label={t('start.email')} className="sm:col-span-2">
          <Input name="email" type="email" required autoComplete="email" className={fieldClass} />
        </Field>
        <Field label={t('start.language')} className="sm:col-span-2">
          <select name="language" required defaultValue="" className={`w-full ${fieldClass}`}>
            <option value="" disabled>{t('start.languagePlaceholder')}</option>
            {['english', 'german', 'french', 'arabic'].map((language) => (
              <option key={language} value={language}>
                {t(`languages.${language}`)}
              </option>
            ))}
          </select>
        </Field>
        <input
          aria-hidden="true"
          autoComplete="off"
          className="absolute -left-[9999px]"
          name="website"
          tabIndex={-1}
        />
      </div>

      <div className="mt-6 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#2E286C]/8 bg-[#F8F7FB] p-4">
          <input
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            name="consent"
            required
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[#533089]"
          />
          <span className="text-xs font-medium leading-5 text-[#2E286C]/65">
            {t('start.consent')}
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 px-1">
          <input name="marketingConsent" type="checkbox" className="h-4 w-4 accent-[#533089]" />
          <span className="text-xs font-medium text-[#2E286C]/55">
            {t('start.marketing')}
          </span>
        </label>
      </div>

      <div className="mt-auto pt-7">
        <Button
          disabled={!consent || submitting}
          size="lg"
          type="submit"
          className="w-full"
        >
          {t('start.submit')}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-3 text-center text-[11px] font-medium leading-5 text-[#2E286C]/40">
          {t('start.privacyNote')}
        </p>
      </div>
    </form>
  );
}

function QuestionView({
  locale,
  onSubmit,
  state,
  submitting,
  t,
}: {
  locale: Locale;
  onSubmit: (body: Record<string, unknown>) => Promise<AssessmentState | null>;
  state: AssessmentState;
  submitting: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const question = state.question!;
  const [selected, setSelected] = useState('');
  const percentage = (question.order / state.totalQuestions) * 100;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#533089]">
            {t('assessment.title', {
              language: t(`languages.${state.candidate.language}`),
            })}
          </p>
          <h2 className="mt-2 text-3xl font-medium text-[#2E286C]">
            {t('assessment.levelLabel', { level: question.level })}
          </h2>
        </div>
        <span className="rounded-full bg-[#533089]/7 px-4 py-2 text-xs font-bold text-[#533089]">
          {t('progress', {
            current: question.order,
            total: state.totalQuestions,
          })}
        </span>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#2E286C]/5">
        <motion.div
          animate={{ width: `${percentage}%` }}
          className="h-full rounded-full bg-[#533089]"
        />
      </div>

      <div className="my-8 rounded-[1.5rem] border border-[#533089]/10 bg-[#F8F6FC] p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#533089] shadow-sm">
            {t('assessment.topicLabel', {
              topic: t(`assessment.topics.${question.topic}`),
            })}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/50 shadow-sm">
            {question.difficulty} / 5
          </span>
        </div>
        <p className="text-xl font-semibold leading-8 text-[#2E286C] sm:text-2xl">
          {question.prompt}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelected(option.id)}
            className={`min-h-16 rounded-2xl border p-4 text-left text-sm font-bold transition ${
              selected === option.id
                ? 'border-[#533089] bg-[#533089] text-white shadow-lg shadow-[#533089]/15'
                : 'border-[#2E286C]/8 bg-white text-[#2E286C] hover:border-[#533089]/30 hover:bg-[#533089]/[0.025]'
            }`}
          >
            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-current/10 text-xs">
              {String.fromCharCode(65 + index)}
            </span>
            {option.label}
          </button>
        ))}
      </div>

      <Button
        disabled={!selected || submitting}
        size="lg"
        className="mt-auto w-full sm:ml-auto sm:mt-8 sm:w-auto"
        onClick={() =>
          void onSubmit({
            locale,
            optionId: selected,
            questionId: question.id,
          })
        }
      >
        {t('assessment.submit')}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ProfileForm({
  locale,
  onSubmit,
  submitting,
  t,
}: {
  locale: Locale;
  onSubmit: (body: Record<string, unknown>) => Promise<AssessmentState | null>;
  submitting: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [isMinor, setIsMinor] = useState(false);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void onSubmit({
      city: form.get('city') || undefined,
      contactWindow: form.get('contactWindow') || undefined,
      isMinor,
      learningGoal: form.get('learningGoal'),
      lessonModel: form.get('lessonModel'),
      locale,
      phone: form.get('phone'),
      preferredContactChannel: form.get('preferredContactChannel'),
      timezone,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <div className="relative mb-7 overflow-hidden rounded-[1.5rem] bg-[#2E286C] p-6 text-white">
        <div className="absolute inset-0 flex items-center justify-center blur-md">
          <span className="font-rosmatika text-7xl font-bold text-white/30">B2</span>
        </div>
        <div className="relative flex min-h-28 flex-col items-center justify-center text-center">
          <LockKeyhole className="mb-2 h-6 w-6" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            {t('profile.locked')}
          </span>
        </div>
      </div>

      <h2 className="text-3xl font-medium text-[#2E286C]">{t('profile.title')}</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-[#2E286C]/55">
        {t('profile.description')}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label={isMinor ? t('profile.guardianPhone') : t('profile.phone')}>
          <Input name="phone" type="tel" required autoComplete="tel" className={fieldClass} />
        </Field>
        <Field label={t('profile.goal')}>
          <select name="learningGoal" required defaultValue="" className={`w-full ${fieldClass}`}>
            <option value="" disabled>-</option>
            {['daily_life', 'career', 'academic', 'exam', 'travel', 'other'].map((item) => (
              <option key={item} value={item}>{t(`profile.goals.${item}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('profile.contactChannel')}>
          <select name="preferredContactChannel" required defaultValue="" className={`w-full ${fieldClass}`}>
            <option value="" disabled>-</option>
            {['phone', 'whatsapp', 'email'].map((item) => (
              <option key={item} value={item}>{t(`profile.channels.${item}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('profile.lessonModel')}>
          <select name="lessonModel" defaultValue="undecided" className={`w-full ${fieldClass}`}>
            {['one_to_one', 'group', 'undecided'].map((item) => (
              <option key={item} value={item}>{t(`profile.models.${item}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('profile.city')}>
          <Input name="city" autoComplete="address-level2" className={fieldClass} />
        </Field>
        <Field label={t('profile.contactWindow')}>
          <Input name="contactWindow" className={fieldClass} />
        </Field>
      </div>

      <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl bg-[#F8F7FB] p-4 text-sm font-semibold text-[#2E286C]/70">
        <input
          checked={isMinor}
          onChange={(event) => setIsMinor(event.target.checked)}
          type="checkbox"
          className="h-4 w-4 accent-[#533089]"
        />
        {t('profile.minor')}
      </label>

      <input type="hidden" name="timezone" value={timezone} />
      <Button disabled={submitting} size="lg" type="submit" className="mt-7 w-full">
        {t('profile.submit')}
        <Sparkles className="h-4 w-4" />
      </Button>
    </form>
  );
}

function ResultView({
  locale,
  onAppointment,
  onRestart,
  state,
  submitting,
  t,
}: {
  locale: Locale;
  onAppointment: (body: Record<string, unknown>) => Promise<AssessmentState | null>;
  onRestart: () => Promise<void>;
  state: AssessmentState;
  submitting: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [showAppointment, setShowAppointment] = useState(false);
  const result = state.result!;

  if (state.appointment) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <span className="mt-6 rounded-full bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
          {t('appointment.status')}
        </span>
        <h2 className="mt-4 text-4xl font-medium text-[#2E286C]">
          {t('appointment.successTitle')}
        </h2>
        <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[#2E286C]/55">
          {t('appointment.successDescription')}
        </p>
        <div className="mt-8 grid w-full max-w-lg gap-3">
          {state.appointment.preferences.map((preference, index) => (
            <div key={preference} className="flex items-center gap-3 rounded-2xl bg-[#F8F7FB] px-4 py-3 text-left">
              <CalendarDays className="h-5 w-5 text-[#533089]" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
                  {t('appointment.preference', { rank: index + 1 })}
                </div>
                <div className="text-sm font-bold text-[#2E286C]">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(preference))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (showAppointment) {
    return (
      <AppointmentForm
        locale={locale}
        onBack={() => setShowAppointment(false)}
        onSubmit={onAppointment}
        submitting={submitting}
        t={t}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[#533089] text-white shadow-2xl shadow-[#533089]/25">
        <div className="absolute inset-3 rounded-full border border-white/20" />
        <span className="font-rosmatika text-7xl font-bold">{result.level}</span>
      </div>
      <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#533089]">
        {t('result.eyebrow')}
      </p>
      <h2 className="mt-2 text-4xl font-medium text-[#2E286C] sm:text-5xl">
        {t('result.title', { level: result.level })}
      </h2>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <span className="rounded-full bg-[#533089]/7 px-4 py-2 text-xs font-bold text-[#533089]">
          {t('result.score', { score: result.score })}
        </span>
        <span className="rounded-full bg-[#2E286C]/5 px-4 py-2 text-xs font-bold text-[#2E286C]/60">
          {t('result.summary', {
            correct: result.correctCount,
            total: result.totalQuestions,
          })}
        </span>
      </div>
      <p className="mt-5 max-w-lg text-sm font-medium leading-6 text-[#2E286C]/55">
        {t('result.description')}
      </p>
      <Button size="lg" className="mt-8 w-full max-w-md" onClick={() => setShowAppointment(true)}>
        <CalendarDays className="h-4 w-4" />
        {t('result.appointmentCta')}
      </Button>
      <button
        type="button"
        disabled={submitting}
        onClick={() => void onRestart()}
        className="mt-4 text-xs font-bold uppercase tracking-wider text-[#2E286C]/45 transition hover:text-[#533089]"
      >
        {t('result.restart')}
      </button>
    </div>
  );
}

function AppointmentForm({
  locale,
  onBack,
  onSubmit,
  submitting,
  t,
}: {
  locale: Locale;
  onBack: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<AssessmentState | null>;
  submitting: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
    [],
  );
  const [preferences, setPreferences] = useState(['', '', '']);
  const minimumDate = useMemo(
    () => new Date(Date.now() + 60 * 60 * 1000),
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preferences.some((preference) => !preference)) return;
    const values = preferences.map((preference) =>
      new Date(preference).toISOString(),
    );
    void onSubmit({ locale, preferences: values, timezone });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/50 hover:text-[#533089]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('steps.result')}
      </button>
      <h2 className="text-3xl font-medium text-[#2E286C] sm:text-4xl">
        {t('appointment.title')}
      </h2>
      <p className="mt-3 text-sm font-medium leading-6 text-[#2E286C]/55">
        {t('appointment.description')}
      </p>

      <div className="mt-8 grid gap-4">
        {[1, 2, 3].map((rank) => (
          <Field key={rank} label={t('appointment.preference', { rank })}>
            <DateTimePicker
              locale={locale}
              min={minimumDate}
              onChange={(value) =>
                setPreferences((current) =>
                  current.map((item, index) =>
                    index === rank - 1 ? value : item,
                  ),
                )
              }
              placeholder={t('appointment.preference', { rank })}
              value={preferences[rank - 1] ?? ''}
            />
          </Field>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <div className="mb-4 rounded-2xl bg-[#F8F7FB] px-4 py-3 text-xs font-semibold text-[#2E286C]/55">
          {t('profile.timezone')}: {timezone}
        </div>
        <Button
          disabled={submitting || preferences.some((preference) => !preference)}
          size="lg"
          type="submit"
          className="w-full"
        >
          {t('appointment.submit')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function Field({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block space-y-2 ${className ?? ''}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
        {label}
      </span>
      {children}
    </label>
  );
}
