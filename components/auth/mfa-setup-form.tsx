'use client';

import Image from 'next/image';
import { useState } from 'react';
import QRCode from 'qrcode';
import { Button, Input } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

type MfaSetupFormProps = {
  labels: {
    backupCodes: string;
    code: string;
    error: string;
    password: string;
    setup: string;
    submit: string;
  };
};

export function MfaSetupForm({ labels }: MfaSetupFormProps) {
  const router = useRouter();
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  async function enable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const password = String(
      new FormData(event.currentTarget).get('password') ?? '',
    );
    const result = await authClient.twoFactor.enable({
      issuer: 'Zümra Akademi',
      password,
    });

    if (result.error || !result.data) {
      setError(labels.error);
      setPending(false);
      return;
    }

    setBackupCodes(result.data.backupCodes);
    setQrDataUrl(await QRCode.toDataURL(result.data.totpURI, {
      margin: 1,
      width: 240,
    }));
    setPending(false);
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
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

  if (!qrDataUrl) {
    return (
      <form onSubmit={enable} className="space-y-4">
        <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
          <span>{labels.password}</span>
          <Input
            autoComplete="current-password"
            minLength={12}
            name="password"
            required
            type="password"
          />
        </label>
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {labels.setup}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <Image
        alt="TOTP QR"
        className="mx-auto rounded-2xl border border-black/5 bg-white p-3"
        height={240}
        src={qrDataUrl}
        unoptimized
        width={240}
      />
      <div className="rounded-2xl bg-white p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#2E286C]/50">
          {labels.backupCodes}
        </p>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          {backupCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
      </div>
      <form onSubmit={verify} className="space-y-4">
        <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
          <span>{labels.code}</span>
          <Input
            autoComplete="one-time-code"
            inputMode="numeric"
            name="code"
            required
          />
        </label>
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {labels.submit}
        </Button>
      </form>
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-red-600">
      {children}
    </p>
  );
}
