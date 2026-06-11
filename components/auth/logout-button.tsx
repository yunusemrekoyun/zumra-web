'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type LogoutButtonProps = {
  children: React.ReactNode;
  className?: string;
  onLogout?: () => void;
};

export function LogoutButton({
  children,
  className,
  onLogout,
}: LogoutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) {
      return;
    }

    setPending(true);
    onLogout?.();
    await authClient.signOut().catch(() => undefined);
    router.replace('/giris');
    router.refresh();
  }

  return (
    <button
      className={cn(className)}
      disabled={pending}
      onClick={() => void logout()}
      type="button"
    >
      {children}
    </button>
  );
}
