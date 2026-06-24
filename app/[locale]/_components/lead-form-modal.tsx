'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '905550000000'
).replace(/[^0-9]/g, '');

export function whatsappHref(text?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

function ChipRow({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-brand-dark/50">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(value === key ? '' : key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              value === key
                ? 'border-brand-primary bg-brand-primary text-white'
                : 'border-black/10 text-brand-dark/60 hover:border-brand-primary/40',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const LANGUAGES = ['english', 'german', 'french', 'arabic'] as const;
const GOALS = [
  'daily_life',
  'career',
  'academic',
  'exam',
  'travel',
  'other',
] as const;
const LESSON_MODELS = ['one_to_one', 'group', 'undecided'] as const;

type LeadProgram = { id?: string; name: string };
type LeadConfig =
  | { kind: 'program'; program: LeadProgram }
  | { kind: 'callback' };

type LeadModalApi = {
  openCallback: () => void;
  openProgram: (program: LeadProgram) => void;
};

const LeadModalContext = createContext<LeadModalApi | null>(null);

export function useLeadModal(): LeadModalApi {
  const ctx = useContext(LeadModalContext);
  if (!ctx) {
    throw new Error('useLeadModal must be used within LeadModalProvider');
  }
  return ctx;
}

export function LeadModalProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LeadConfig | null>(null);
  const openProgram = useCallback(
    (program: LeadProgram) => setConfig({ kind: 'program', program }),
    [],
  );
  const openCallback = useCallback(() => setConfig({ kind: 'callback' }), []);

  return (
    <LeadModalContext.Provider value={{ openCallback, openProgram }}>
      {children}
      {config && (
        <LeadFormModal config={config} onClose={() => setConfig(null)} />
      )}
    </LeadModalContext.Provider>
  );
}

function LeadFormModal({
  config,
  onClose,
}: {
  config: LeadConfig;
  onClose: () => void;
}) {
  const t = useTranslations('public.leadForm');
  const locale = useLocale();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactWindow, setContactWindow] = useState('');
  const [language, setLanguage] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [lessonModel, setLessonModel] = useState('');
  const [consent, setConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'error' | 'success'>(
    'idle',
  );
  const [formStartedAt] = useState(() => Date.now());

  const isProgram = config.kind === 'program';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent || status === 'busy') return;
    setStatus('busy');

    try {
      const params = new URLSearchParams(window.location.search);
      const attribution: Record<string, string> = {};
      for (const key of [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
      ]) {
        const value = params.get(key);
        if (value) attribution[key] = value;
      }

      const response = await fetch('/api/public/lead', {
        body: JSON.stringify({
          attribution: Object.keys(attribution).length
            ? attribution
            : undefined,
          consent: true,
          contactWindow: config.kind === 'callback' ? contactWindow : undefined,
          email,
          firstName,
          formStartedAt,
          idempotencyKey: crypto.randomUUID(),
          kind: config.kind,
          language:
            config.kind === 'callback' ? language || undefined : undefined,
          lastName,
          learningGoal: learningGoal || undefined,
          lessonModel: lessonModel || undefined,
          locale: locale === 'en' ? 'en' : 'tr',
          marketingConsent,
          phone,
          programId: config.kind === 'program' ? config.program.id : undefined,
          referrer: document.referrer || undefined,
          website,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('lead_failed');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  const inputClass =
    'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-brand-dark outline-none focus:border-brand-primary/40';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-rosmatika text-xl font-medium text-brand-dark">
              {isProgram ? t('programTitle') : t('callbackTitle')}
            </h3>
            <p className="mt-1 text-sm font-medium text-brand-dark/50">
              {isProgram
                ? t('programSubtitle', { program: config.program.name })
                : t('callbackSubtitle')}
            </p>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-primary">
              {t('trust')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-full p-1.5 text-brand-dark/40 transition-colors hover:bg-black/5 hover:text-brand-dark"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <p className="font-bold text-brand-dark">{t('successTitle')}</p>
              <p className="mt-1 text-sm font-medium text-brand-dark/50">
                {t('successText')}
              </p>
            </div>
            <a
              href={whatsappHref(t('whatsappMessage'))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white"
            >
              <MessageCircle className="h-4 w-4" />
              {t('whatsappAlt')}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-brand-dark/50 hover:text-brand-dark"
            >
              {t('close')}
            </button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="hidden"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder={t('firstName')}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder={t('lastName')}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>
            <input
              className={inputClass}
              type="email"
              placeholder={t('email')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className={inputClass}
              type="tel"
              placeholder={t('phone')}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
            {config.kind === 'callback' && (
              <input
                className={inputClass}
                placeholder={t('contactWindow')}
                value={contactWindow}
                onChange={(event) => setContactWindow(event.target.value)}
              />
            )}
            {config.kind === 'callback' && (
              <select
                className={inputClass}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="">{t('languageLabel')}</option>
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {t(`languages.${lang}`)}
                  </option>
                ))}
              </select>
            )}
            <ChipRow
              label={t('goalLabel')}
              onChange={setLearningGoal}
              options={GOALS.map((goal) => [goal, t(`goals.${goal}`)])}
              value={learningGoal}
            />
            <ChipRow
              label={t('lessonModelLabel')}
              onChange={setLessonModel}
              options={LESSON_MODELS.map((model) => [
                model,
                t(`lessonModels.${model}`),
              ])}
              value={lessonModel}
            />
            <label className="flex items-start gap-2.5 text-xs font-medium text-brand-dark/60">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-primary"
                required
              />
              {t('consent')}
            </label>
            <label className="flex items-start gap-2.5 text-xs font-medium text-brand-dark/60">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(event) => setMarketingConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-primary"
              />
              {t('marketingConsent')}
            </label>
            {status === 'error' && (
              <p className="text-xs font-semibold text-red-600">
                {t('errorText')}
              </p>
            )}
            <button
              type="submit"
              disabled={!consent || status === 'busy'}
              className="w-full rounded-2xl bg-brand-primary px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-primary/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'busy' ? t('submitting') : t('submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
