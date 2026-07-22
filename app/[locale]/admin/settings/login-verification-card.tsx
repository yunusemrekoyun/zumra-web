'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button, Input, ModulePanel } from '@/components/ui';

export function LoginVerificationCard() {
  const t = useTranslations('admin.settings.loginVerification');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  // The value the admin is trying to switch TO, while the password
  // confirmation panel is open. null = no pending change.
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'error' | 'success';
  }>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          credentials: 'same-origin',
        });
        const body = await response.json().catch(() => ({}));
        if (!active) return;
        if (
          response.ok &&
          typeof body.settings?.loginVerificationEnabled === 'boolean'
        ) {
          setEnabled(body.settings.loginVerificationEnabled);
          setLoadFailed(false);
        } else {
          // Never assume "enabled" from a failed load — that could mask a real
          // "verification is OFF" state and mislead the admin into thinking the
          // site is protected. Block the control and surface the failure.
          setLoadFailed(true);
        }
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadToken]);

  function retryLoad() {
    setLoading(true);
    setMessage(undefined);
    setReloadToken((token) => token + 1);
  }

  function openConfirm(next: boolean) {
    if (loading || busy || loadFailed) return;
    setMessage(undefined);
    setPassword('');
    setPendingValue(next);
  }

  function cancelConfirm() {
    setPendingValue(null);
    setPassword('');
  }

  async function confirmChange() {
    if (pendingValue === null || busy || !password) return;
    const next = pendingValue;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/admin/settings/login-verification', {
        body: JSON.stringify({ enabled: next, password }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // A 403 from this endpoint means the password (or MFA-admin) check
        // failed or was rate-limited — tell the admin specifically.
        throw new Error(response.status === 403 ? 'confirm' : 'generic');
      }
      setEnabled(typeof body.enabled === 'boolean' ? body.enabled : next);
      setPendingValue(null);
      setPassword('');
      setMessage({
        text: next
          ? body.sessionsRevoked
            ? t('successOnRevoked')
            : t('successOn')
          : t('successOff'),
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error && error.message === 'confirm'
            ? t('confirmError')
            : t('error'),
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  const confirming = pendingValue !== null;

  return (
    <ModulePanel>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#533089]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#533089]">
        <ShieldCheck className="h-4 w-4" />
        {t('badge')}
      </div>
      <h2 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
        {t('title')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#2E286C]/65">
        {t('description')}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[#2E286C]/10 bg-white p-4 lg:max-w-2xl">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              enabled
                ? 'bg-[#0F9F6E]/12 text-[#0B7F58]'
                : 'bg-[#B42318]/12 text-[#B42318]'
            }`}
          >
            {enabled ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <ShieldAlert className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#2E286C]">
              {enabled ? t('stateOn') : t('stateOff')}
            </p>
            <p className="text-[12px] font-semibold leading-5 text-[#2E286C]/55">
              {enabled ? t('stateOnHint') : t('stateOffHint')}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('title')}
          disabled={loading || busy || loadFailed || confirming}
          onClick={() => openConfirm(!enabled)}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            enabled ? 'bg-[#0F9F6E]' : 'bg-[#2E286C]/25'
          }`}
        >
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
              enabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {confirming && (
        <div className="mt-4 max-w-2xl rounded-2xl border-2 border-[#533089]/20 bg-[#533089]/[0.04] p-4">
          <p className="flex items-start gap-2 text-[13px] font-semibold leading-5 text-[#2E286C]/75">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#533089]" />
            {pendingValue ? t('confirmEnableBody') : t('warning')}
          </p>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void confirmChange();
            }}
          >
            <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-bold uppercase tracking-wider text-[#2E286C]/55">
              {t('passwordLabel')}
              <Input
                autoFocus
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !password}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {t('confirm')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={cancelConfirm}
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {!enabled && !confirming && !loadFailed && (
        <p className="mt-4 flex max-w-2xl items-start gap-2 rounded-2xl bg-[#B42318]/8 px-4 py-3 text-[12px] font-semibold leading-5 text-[#B42318]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {t('warning')}
        </p>
      )}

      <p className="mt-4 max-w-2xl rounded-2xl bg-[#2E286C]/4 px-4 py-3 text-[12px] font-semibold leading-5 text-[#2E286C]/60">
        {t('note')}
      </p>

      {!loading && loadFailed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]">
          {t('loadError')}
          <button
            type="button"
            onClick={retryLoad}
            className="rounded-full bg-[#B42318]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#B42318] transition-colors hover:bg-[#B42318]/20"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {message && (
        <div
          className={
            message.type === 'success'
              ? 'mt-4 rounded-2xl bg-[#0F9F6E]/10 px-4 py-3 text-sm font-semibold text-[#0B7F58]'
              : 'mt-4 rounded-2xl bg-[#B42318]/10 px-4 py-3 text-sm font-semibold text-[#B42318]'
          }
        >
          {message.text}
        </div>
      )}
    </ModulePanel>
  );
}
