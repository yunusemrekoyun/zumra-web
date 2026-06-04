'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { locales, type Locale } from '@/i18n/routing';

type LanguageSwitcherProps = {
  className?: string;
  variant?: 'public' | 'workspace';
};

const labels: Record<Locale, string> = {
  tr: 'TR',
  en: 'EN',
};

export function LanguageSwitcher({ className, variant = 'public' }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common.languageSwitcher');
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      return;
    }

    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-black/5 bg-white/80 p-1 shadow-sm backdrop-blur-md',
        variant === 'workspace' && 'bg-white shadow-sm',
        className,
      )}
      aria-label={t('label')}
    >
      <Languages className="ml-2 h-4 w-4 text-[#2E286C]/40" />
      {locales.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => switchLocale(item)}
          className={cn(
            'min-h-8 rounded-full px-3 text-[11px] font-bold uppercase tracking-widest transition-colors',
            item === locale
              ? 'bg-[#533089] text-white shadow-sm'
              : 'text-[#2E286C]/50 hover:bg-[#533089]/5 hover:text-[#533089]',
          )}
          aria-pressed={item === locale}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}
