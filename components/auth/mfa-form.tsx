'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

type MfaFormProps = {
  labels: {
    code: string;
    error: string;
    submit: string;
  };
};

export function MfaForm({ labels }: MfaFormProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    const result = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: false,
    });

    if (result.error) {
      setError(labels.error);
      setPending(false);
      return;
    }

    router.push('/admin');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
        <span>{labels.code}</span>
        <Input
          autoComplete="one-time-code"
          inputMode="numeric"
          name="code"
          required
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {labels.submit}
      </Button>
    </form>
  );
}
