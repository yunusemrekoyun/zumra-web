'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Route-level error boundary. Kept fully self-contained (no i18n hooks, no
// shared UI) so it can never fail while rendering the failure itself. Locale is
// read from the URL so the copy matches the user's language.
const COPY = {
  tr: {
    title: 'Bir şeyler ters gitti',
    body: 'Beklenmeyen bir hata oluştu. Tekrar deneyebilir veya ana sayfaya dönebilirsiniz. Sorun sürerse bu kodu destek ekibiyle paylaşın.',
    retry: 'Tekrar dene',
    home: 'Ana sayfa',
    ref: 'Hata kodu',
  },
  en: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred. You can try again or go back home. If it keeps happening, share this code with support.',
    retry: 'Try again',
    home: 'Home',
    ref: 'Error code',
  },
} as const;

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for local debugging; production logs capture the digest.
    console.error(error);
  }, [error]);

  const isEn =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/en');
  const t = isEn ? COPY.en : COPY.tr;
  const home = isEn ? '/en' : '/tr';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#EBE9F1] p-6 font-neubau text-[#2E286C]">
      <div className="w-full max-w-md rounded-[2rem] border border-white bg-[#F8F9FC] p-8 text-center shadow-[0_20px_60px_-15px_rgba(83,48,137,0.15)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#B42318]/10">
          <AlertTriangle className="h-7 w-7 text-[#B42318]" />
        </div>
        <h1 className="font-rosmatika text-2xl font-bold">{t.title}</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#2E286C]/60">
          {t.body}
        </p>
        {error.digest && (
          <p className="mt-4 rounded-xl bg-black/[0.03] px-3 py-2 font-mono text-xs text-[#2E286C]/45">
            {t.ref}: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#533089] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#43236f]"
          >
            <RotateCcw className="h-4 w-4" />
            {t.retry}
          </button>
          <a
            href={home}
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-[#2E286C] ring-1 ring-black/[0.06] transition-colors hover:bg-black/[0.02]"
          >
            {t.home}
          </a>
        </div>
      </div>
    </div>
  );
}
