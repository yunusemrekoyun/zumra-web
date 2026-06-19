'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

type ActivationFormProps = {
  labels: {
    accountExists: string;
    confirmPassword: string;
    error: string;
    forbidden: string;
    invalidPassword: string;
    mismatch: string;
    password: string;
    rateLimited: string;
    submit: string;
    success: string;
  };
  token: string;
};

export function ActivationForm({ labels, token }: ActivationFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');

    if (password !== confirmation) {
      setMessage(labels.mismatch);
      return;
    }

    setPending(true);
    const response = await fetch('/api/invitations/activate', {
      body: JSON.stringify({ password, token }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(activationErrorMessage(body.error, labels));
      setPending(false);
      return;
    }

    setMessage(labels.success);
    setTimeout(() => router.push('/giris'), 800);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
        <span>{labels.password}</span>
        <Input
          autoComplete="new-password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
        <span>{labels.confirmPassword}</span>
        <Input
          autoComplete="new-password"
          minLength={12}
          name="confirmation"
          required
          type="password"
        />
      </label>
      {message ? (
        <p role="status" className="text-sm font-medium text-[#533089]">
          {message}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending || !token} type="submit">
        {labels.submit}
      </Button>
    </form>
  );
}

function activationErrorMessage(
  code: unknown,
  labels: ActivationFormProps['labels'],
) {
  if (code === 'invitation_email_already_registered') {
    return labels.accountExists;
  }
  if (code === 'invalid_password') {
    return labels.invalidPassword;
  }
  if (code === 'rate_limited') {
    return labels.rateLimited;
  }
  if (code === 'forbidden') {
    return labels.forbidden;
  }
  return labels.error;
}
