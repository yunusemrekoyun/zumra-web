'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { Button, Input, ModulePanel } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

const CONFIRMATION_PHRASE = 'SIFIRLA';

type ResetMessage = {
  text: string;
  type: 'error' | 'success';
};

export function DevResetCard({ enabled }: { enabled: boolean }) {
  const t = useTranslations('admin.settings.devReset');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ResetMessage>();
  const canSubmit = useMemo(
    () =>
      enabled &&
      !busy &&
      password.length >= 12 &&
      confirmation === CONFIRMATION_PHRASE,
    [busy, confirmation, enabled, password],
  );

  async function submitReset(event: FormEvent) {
    event.preventDefault();

    if (confirmation !== CONFIRMATION_PHRASE) {
      setMessage({ text: t('invalidConfirmation'), type: 'error' });
      return;
    }

    setBusy(true);
    setMessage(undefined);

    try {
      const response = await fetch('/api/admin/dev-reset', {
        body: JSON.stringify({
          confirmation,
          password,
        }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(body.error ?? 'reset_failed'));
      }

      setPassword('');
      setConfirmation('');
      setMessage({ text: t('success'), type: 'success' });
      router.refresh();
    } catch (error) {
      setMessage({
        text: resetErrorMessage(error, t),
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModulePanel className="border-[#B42318]/15 bg-[#B42318]/5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#B42318]">
            <ShieldAlert className="h-4 w-4" />
            {t('badge')}
          </div>
          <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
            {t('title')}
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#2E286C]/65">
            {enabled ? t('description') : t('disabled')}
          </p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-xs font-semibold leading-5 text-[#B42318] shadow-sm">
          {t('warning')}
        </div>
      </div>

      <form onSubmit={submitReset} className="mt-6 grid gap-4 lg:max-w-xl">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {t('password')}
          <Input
            autoComplete="current-password"
            disabled={!enabled || busy}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('passwordPlaceholder')}
            type="password"
            value={password}
          />
        </label>

        <label className="grid gap-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
          {t('confirmation')}
          <Input
            autoCapitalize="characters"
            autoComplete="off"
            disabled={!enabled || busy}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={CONFIRMATION_PHRASE}
            value={confirmation}
          />
          <span className="text-[11px] font-semibold normal-case tracking-normal text-[#2E286C]/45">
            {t('confirmationHint', { phrase: CONFIRMATION_PHRASE })}
          </span>
        </label>

        {message && (
          <div
            className={
              message.type === 'success'
                ? 'rounded-2xl bg-[#0F9F6E]/10 px-4 py-3 text-sm font-semibold text-[#0B7F58]'
                : 'rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]'
            }
          >
            {message.text}
          </div>
        )}

        <Button
          className="bg-[#B42318] shadow-[#B42318]/20 hover:bg-[#912018]"
          disabled={!canSubmit}
          type="submit"
        >
          <RotateCcw className="h-4 w-4" />
          {busy ? t('resetting') : t('submit')}
        </Button>
      </form>
    </ModulePanel>
  );
}

function resetErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
) {
  const code = error instanceof Error ? error.message : 'reset_failed';

  if (code === 'dev_reset_disabled') return t('disabled');
  if (code === 'forbidden') return t('errors.forbidden');
  if (code === 'invalid_request') return t('errors.invalidRequest');
  if (code === 'password_failed') return t('errors.passwordFailed');
  if (code === 'reset_failed') return t('errors.resetFailed');

  return t('error');
}
