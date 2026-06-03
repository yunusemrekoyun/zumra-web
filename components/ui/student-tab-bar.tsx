'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, TrendingUp, MessageSquare, CircleUserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Tab definitions ─────────────────────────────────────────────── */

type StudentTab = {
  icon: LucideIcon;
  label: string;
  path: string;
};

const tabs: StudentTab[] = [
  { icon: BookOpen, label: 'Derslerim', path: '/ogrenci' },
  { icon: TrendingUp, label: 'İlerleme', path: '/ogrenci/ilerleme' },
  { icon: MessageSquare, label: 'Mesajlar', path: '/ogrenci/mesajlar' },
  { icon: CircleUserRound, label: 'Profil', path: '/ogrenci/profil' },
];

/* ─── Props ───────────────────────────────────────────────────────── */

type StudentTabBarProps = {
  pathname: string;
};

/* ─── Component ───────────────────────────────────────────────────── */

export function StudentTabBar({ pathname }: StudentTabBarProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-white/80 backdrop-blur-xl border-t border-black/[0.04]',
        'shadow-[0_-4px_24px_-4px_rgba(46,40,108,0.08)]',
      )}
      style={{ paddingBottom: 'var(--mobile-sab)' }}
      aria-label="Öğrenci navigasyonu"
    >
      <div className="flex items-stretch h-[var(--mobile-tab-bar-h)]">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.path ||
            (tab.path !== '/ogrenci' && pathname.startsWith(tab.path));

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200 relative',
                isActive
                  ? 'text-[#533089]'
                  : 'text-[#2E286C]/40 active:text-[#2E286C]/70',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute top-1.5 w-1 h-1 rounded-full bg-[#533089]" />
              )}
              <tab.icon
                className={cn(
                  'w-[22px] h-[22px] transition-transform duration-200',
                  isActive && 'scale-110',
                )}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              <span
                className={cn(
                  'text-[10px] leading-none tracking-wide',
                  isActive ? 'font-bold' : 'font-medium',
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
