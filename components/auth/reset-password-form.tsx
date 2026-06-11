'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

type ResetPasswordFormProps = {
  labels: {
    confirmPassword: string;
    error: string;
    mismatch: string;
    password: string;
    sameAsCurrent: string;
    submit: string;
    success: string;
  };
  token: string;
};

export function ResetPasswordForm({
  labels,
  token,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');

    if (newPassword !== confirmation) {
      setMessage(labels.mismatch);
      return;
    }

    setPending(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        body: JSON.stringify({ newPassword, token }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { code?: string }
          | null;
        setMessage(
          payload?.code === 'PASSWORD_SAME_AS_CURRENT'
            ? labels.sameAsCurrent
            : labels.error,
        );
        return;
      }

      setMessage(labels.success);
      setTimeout(() => router.replace('/giris'), 800);
    } catch {
      setMessage(labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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
        <p className="text-sm font-medium text-[#533089]" role="status">
          {message}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending || !token} type="submit">
        {labels.submit}
      </Button>
    </form>
  );
}
