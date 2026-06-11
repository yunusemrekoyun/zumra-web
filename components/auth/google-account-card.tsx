'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Link2, Unlink } from 'lucide-react';
import type { GoogleIdentityStatus } from '@/lib/domain';
import { Button, Card, Input, SectionHeader, StatusChip } from '@/components/ui';

type GoogleAccountCardProps = {
  initialStatus: GoogleIdentityStatus;
  labels: {
    actionError: string;
    connected: string;
    description: string;
    disconnected: string;
    link: string;
    linkedSuccess: string;
    password: string;
    title: string;
    unlink: string;
    unlinkedSuccess: string;
    verifiedEmail: string;
  };
  locale: 'tr' | 'en';
};

export function GoogleAccountCard({
  initialStatus,
  labels,
  locale,
}: GoogleAccountCardProps) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(initialStatus);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    searchParams.get('google') === 'error' ? labels.actionError : '',
  );
  const linkedSuccess = searchParams.get('google') === 'linked';
  const [unlinkedSuccess, setUnlinkedSuccess] = useState(false);

  if (!status.configured) {
    return null;
  }

  async function handleLink() {
    setError('');
    setUnlinkedSuccess(false);
    setPending(true);

    try {
      const response = await fetch('/api/student/google/link', {
        body: JSON.stringify({ locale, password }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
      };

      if (!response.ok || !body.url) {
        throw new Error('google_link_failed');
      }

      window.location.assign(body.url);
    } catch {
      setError(labels.actionError);
      setPending(false);
    }
  }

  async function handleUnlink() {
    setError('');
    setUnlinkedSuccess(false);
    setPending(true);

    try {
      const response = await fetch('/api/student/google/unlink', {
        body: JSON.stringify({ password }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('google_unlink_failed');
      }

      setPassword('');
      setStatus({ configured: true, linked: false });
      setUnlinkedSuccess(true);
    } catch {
      setError(labels.actionError);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <SectionHeader
        description={labels.description}
        title={labels.title}
      />

      <div className="rounded-2xl border border-black/[0.04] bg-[#F8F9FC] p-4 lg:p-5">
        <div className="flex items-start gap-4">
          {status.identity?.avatarUrl ? (
            <Image
              alt=""
              className="size-12 rounded-2xl object-cover"
              height={48}
              referrerPolicy="no-referrer"
              src={status.identity.avatarUrl}
              width={48}
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-bold text-[#4285F4] shadow-sm">
              G
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-[#2E286C]">
                {status.identity?.displayName ?? 'Google'}
              </p>
              <StatusChip tone={status.linked ? 'emerald' : 'gray'}>
                {status.linked ? labels.connected : labels.disconnected}
              </StatusChip>
            </div>
            {status.identity ? (
              <p className="mt-1 break-all text-sm font-medium text-[#2E286C]/55">
                {labels.verifiedEmail}: {status.identity.verifiedEmail}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block space-y-2 text-sm font-semibold text-[#2E286C]/75">
            <span>{labels.password}</span>
            <Input
              autoComplete="current-password"
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {linkedSuccess && status.linked ? (
            <Feedback icon={<CheckCircle2 className="size-4" />}>
              {labels.linkedSuccess}
            </Feedback>
          ) : null}
          {unlinkedSuccess ? (
            <Feedback icon={<CheckCircle2 className="size-4" />}>
              {labels.unlinkedSuccess}
            </Feedback>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <Button
            className="w-full"
            disabled={pending || password.length < 12}
            onClick={status.linked ? handleUnlink : handleLink}
            variant={status.linked ? 'secondary' : 'primary'}
          >
            {status.linked ? (
              <Unlink className="size-4" />
            ) : (
              <Link2 className="size-4" />
            )}
            {status.linked ? labels.unlink : labels.link}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Feedback({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
      {icon}
      {children}
    </p>
  );
}
