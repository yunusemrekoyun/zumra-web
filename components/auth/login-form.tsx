'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

type LoginFormProps = {
  googleConfigured: boolean;
  googleError: boolean;
  labels: {
    error: string;
    google: string;
    googleError: string;
    or: string;
    rateLimited: string;
    password: string;
    submit: string;
    username: string;
    forgotPassword: string;
  };
  locale: 'tr' | 'en';
};

type DeviceChallengeResponse = {
  challengeId?: string;
  destination?: string;
  error?: string;
  required?: boolean;
  type?: string;
};

export function LoginForm({
  googleConfigured,
  googleError,
  labels,
  locale,
}: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = new FormData(event.currentTarget);

    try {
      await fetch('/api/security/device/bootstrap', { method: 'POST' });
      const result = await authClient.signIn.username({
        password: String(form.get('password') ?? ''),
        rememberMe: true,
        username: String(form.get('username') ?? ''),
      });

      if (result.error) {
        setError(labels.error);
        return;
      }

      if (
        result.data &&
        'twoFactorRedirect' in result.data &&
        result.data.twoFactorRedirect
      ) {
        router.push('/mfa');
        return;
      }

      const response = await fetch('/api/security/device/challenge', {
        body: JSON.stringify({ locale }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const challenge = (await response.json()) as DeviceChallengeResponse;

      if (challenge.type === 'admin_mfa_setup') {
        router.push('/mfa-kurulum');
        return;
      }

      if (challenge.type === 'admin_mfa') {
        router.push('/mfa');
        return;
      }

      if (!response.ok) {
        await authClient.signOut().catch(() => undefined);
        setError(
          response.status === 429 || challenge.error === 'rate_limited'
            ? labels.rateLimited
            : labels.error,
        );
        return;
      }

      if (challenge.required && challenge.challengeId) {
        router.push(
          `/cihaz-dogrulama?challenge=${encodeURIComponent(challenge.challengeId)}&to=${encodeURIComponent(challenge.destination ?? '/')}`,
        );
        return;
      }

      if (challenge.destination) {
        router.push(challenge.destination as never);
        return;
      }

      await authClient.signOut().catch(() => undefined);
      setError(labels.error);
    } catch {
      setError(labels.error);
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setGooglePending(true);

    try {
      const bootstrap = await fetch('/api/security/device/bootstrap', {
        method: 'POST',
      });

      if (!bootstrap.ok) {
        throw new Error('device_bootstrap_failed');
      }

      const result = await authClient.signIn.social({
        callbackURL: `/${locale}/google-tamamla?mode=signin`,
        errorCallbackURL: `/${locale}/giris?google=error`,
        provider: 'google',
        requestSignUp: false,
      });

      if (result.error) {
        setError(labels.googleError);
        setGooglePending(false);
      }
    } catch {
      setError(labels.googleError);
      setGooglePending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (
      event.key !== 'Enter' ||
      event.nativeEvent.isComposing ||
      event.repeat
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  return (
    <div className="space-y-5">
      {(googleError || error) ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error || labels.googleError}
        </p>
      ) : null}
      <form
        className="space-y-4"
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
      >
        <Field label={labels.username}>
          <Input autoComplete="username" name="username" required />
        </Field>
        <Field label={labels.password}>
          <Input
            autoComplete="current-password"
            minLength={12}
            name="password"
            required
            type="password"
          />
        </Field>
        <div className="text-right">
          <Link
            className="text-sm font-semibold text-[#533089] hover:underline"
            href="/sifremi-unuttum"
          >
            {labels.forgotPassword}
          </Link>
        </div>
        <Button
          className="w-full"
          disabled={pending || googlePending}
          type="submit"
        >
          {labels.submit}
        </Button>
      </form>

      {googleConfigured ? (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-black/[0.06]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2E286C]/35">
              {labels.or}
            </span>
            <span className="h-px flex-1 bg-black/[0.06]" />
          </div>
          <Button
            className="w-full normal-case tracking-normal"
            disabled={pending || googlePending}
            onClick={handleGoogleSignIn}
            variant="secondary"
          >
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-full bg-white text-sm font-bold text-[#4285F4] shadow-sm"
            >
              G
            </span>
            {labels.google}
          </Button>
        </>
      ) : null}
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
      <span>{label}</span>
      {children}
    </label>
  );
}
