'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';

type DeviceVerificationFormProps = {
  challengeId: string;
  destination: string;
  labels: {
    code: string;
    error: string;
    submit: string;
  };
};

export function DeviceVerificationForm({
  challengeId,
  destination,
  labels,
}: DeviceVerificationFormProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const otp = String(new FormData(event.currentTarget).get('otp') ?? '');
    const response = await fetch('/api/security/device/verify', {
      body: JSON.stringify({ challengeId, otp }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    if (!response.ok) {
      setError(labels.error);
      setPending(false);
      return;
    }

    router.push(destination as never);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
        <span>{labels.code}</span>
        <Input
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          name="otp"
          pattern="[0-9]{6}"
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
