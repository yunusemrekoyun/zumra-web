import type { ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type AuthShellProps = {
  children: ReactNode;
  description: string;
  locale: 'tr' | 'en';
  title: string;
};

export function AuthShell({
  children,
  description,
  locale,
  title,
}: AuthShellProps) {
  return (
    <main className="min-h-dvh bg-[#EBE9F1] px-4 py-8 sm:px-6 flex items-center justify-center font-neubau text-[#2E286C]">
      <section className="w-full max-w-md rounded-[2rem] border border-white bg-[#F8F9FC] p-6 shadow-[0_20px_60px_-15px_rgba(83,48,137,0.18)] sm:p-8">
        <Link
          href="/"
          locale={locale}
          className="mb-8 inline-flex items-center gap-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#533089] text-white shadow-lg shadow-[#533089]/25">
            <Zap className="h-5 w-5 fill-white" />
          </span>
          <span className="font-rosmatika text-2xl font-bold">Zümra</span>
        </Link>
        <h1 className="font-rosmatika text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#2E286C]/60">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
