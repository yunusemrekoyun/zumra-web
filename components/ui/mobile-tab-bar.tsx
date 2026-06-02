'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { LayoutGrid, Users, GraduationCap, CreditCard, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Tab definitions ─────────────────────────────────────────────── */

type MobileTab = {
  icon: LucideIcon;
  label: string;
  path: string;
};

const tabs: MobileTab[] = [
  { icon: LayoutGrid, label: 'Ana Sayfa', path: '/admin' },
  { icon: Users, label: 'Leadler', path: '/admin/leads' },
  { icon: GraduationCap, label: 'Öğrenciler', path: '/admin/students' },
  { icon: CreditCard, label: 'Ödemeler', path: '/admin/payments' },
];

/* ─── Props ───────────────────────────────────────────────────────── */

type MobileTabBarProps = {
  navigateWithTransition: (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => void;
  onMorePress: () => void;
  pathname: string;
  warmRoute: (targetPath: string) => void;
};

/* ─── Component ───────────────────────────────────────────────────── */

export function MobileTabBar({
  navigateWithTransition,
  onMorePress,
  pathname,
  warmRoute,
}: MobileTabBarProps) {
  const isMoreActive = !tabs.some(
    (t) => pathname === t.path || (t.path !== '/admin' && pathname.startsWith(t.path)),
  );

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-white/80 backdrop-blur-xl border-t border-black/[0.04]',
        'shadow-[0_-4px_24px_-4px_rgba(46,40,108,0.08)]',
      )}
      style={{ paddingBottom: 'var(--mobile-sab)' }}
      aria-label="Ana navigasyon"
    >
      <div className="flex items-stretch h-[var(--mobile-tab-bar-h)]">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.path ||
            (tab.path !== '/admin' && pathname.startsWith(tab.path));

          return (
            <Link
              key={tab.path}
              href={tab.path}
              onClick={(e) => navigateWithTransition(e, tab.path)}
              onMouseEnter={() => warmRoute(tab.path)}
              onFocus={() => warmRoute(tab.path)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200 relative',
                isActive
                  ? 'text-[#533089]'
                  : 'text-[#2E286C]/40 active:text-[#2E286C]/70',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator dot */}
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

        {/* More button */}
        <button
          type="button"
          onClick={onMorePress}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200 relative',
            isMoreActive
              ? 'text-[#533089]'
              : 'text-[#2E286C]/40 active:text-[#2E286C]/70',
          )}
          aria-label="Daha fazla menü"
        >
          {isMoreActive && (
            <span className="absolute top-1.5 w-1 h-1 rounded-full bg-[#533089]" />
          )}
          <MoreHorizontal
            className={cn(
              'w-[22px] h-[22px] transition-transform duration-200',
              isMoreActive && 'scale-110',
            )}
            strokeWidth={isMoreActive ? 2.4 : 1.8}
          />
          <span
            className={cn(
              'text-[10px] leading-none tracking-wide',
              isMoreActive ? 'font-bold' : 'font-medium',
            )}
          >
            Daha Fazla
          </span>
        </button>
      </div>
    </nav>
  );
}
