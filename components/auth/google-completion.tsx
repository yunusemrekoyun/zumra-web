'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';

type GoogleCompletionProps = {
  labels: {
    error: string;
    pending: string;
  };
  locale: 'tr' | 'en';
  mode: 'link' | 'signin';
};

type DeviceChallengeResponse = {
  challengeId?: string;
  destination?: string;
  required?: boolean;
};

export function GoogleCompletion({
  labels,
  locale,
  mode,
}: GoogleCompletionProps) {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    async function complete() {
      try {
        const completion = await fetch('/api/student/google/complete', {
          body: JSON.stringify({ mode }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });

        if (!completion.ok) {
          throw new Error('google_completion_failed');
        }

        if (mode === 'link') {
          // Teachers link from their own profile; send them back there.
          const body = (await completion.json().catch(() => ({}))) as {
            role?: string;
          };
          router.replace(
            body.role === 'teacher'
              ? '/ogretmen/profil?google=linked'
              : '/ogrenci/profil?google=linked',
          );
          return;
        }

        const bootstrapResponse = await fetch(
          '/api/security/device/bootstrap',
          { method: 'POST' },
        );

        if (!bootstrapResponse.ok) {
          throw new Error('device_bootstrap_failed');
        }

        const deviceResponse = await fetch('/api/security/device/challenge', {
          body: JSON.stringify({ locale }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        const challenge =
          (await deviceResponse.json()) as DeviceChallengeResponse;

        if (!deviceResponse.ok) {
          throw new Error('device_challenge_failed');
        }

        if (challenge.required && challenge.challengeId) {
          router.replace(
            `/cihaz-dogrulama?challenge=${encodeURIComponent(challenge.challengeId)}&to=${encodeURIComponent(challenge.destination ?? '/ogrenci')}`,
          );
          return;
        }

        router.replace((challenge.destination ?? '/ogrenci') as never);
      } catch {
        await authClient.signOut().catch(() => undefined);
        setFailed(true);
        window.setTimeout(() => {
          router.replace('/giris?google=error');
        }, 1200);
      }
    }

    void complete();
  }, [locale, mode, router]);

  return (
    <p
      aria-live="polite"
      className={`text-sm font-medium ${failed ? 'text-red-600' : 'text-[#2E286C]/60'}`}
    >
      {failed ? labels.error : labels.pending}
    </p>
  );
}
