'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

type ForgotPasswordFormProps = {
  labels: {
    email: string;
    error: string;
    submit: string;
    success: string;
  };
  locale: 'tr' | 'en';
};

export function ForgotPasswordForm({
  labels,
  locale,
}: ForgotPasswordFormProps) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const email = String(new FormData(event.currentTarget).get('email') ?? '');

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/${locale}/sifre-sifirla`,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });

      setMessage(response.ok ? labels.success : labels.error);
    } catch {
      setMessage(labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
        <span>{labels.email}</span>
        <Input autoComplete="email" name="email" required type="email" />
      </label>
      {message ? (
        <p className="text-sm font-medium text-[#533089]" role="status">
          {message}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {labels.submit}
      </Button>
    </form>
  );
}
