'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { CircleUserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTabItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

type MobileTabBarProps = {
  items: MobileTabItem[];
  moreIcon?: LucideIcon;
  moreLabel?: string;
  navigateWithTransition: (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => void;
  onMorePress?: () => void;
  pathname: string;
  rootPath: string;
  warmRoute: (targetPath: string) => void;
};

export function MobileTabBar({
  items,
  moreIcon: MoreIcon = CircleUserRound,
  moreLabel = 'Hesabım',
  navigateWithTransition,
  onMorePress,
  pathname,
  rootPath,
  warmRoute,
}: MobileTabBarProps) {
  const hasMoreButton = Boolean(onMorePress);
  const isMoreActive = hasMoreButton && !items.some(
    (item) => isRouteActive(pathname, item.path, rootPath),
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
        {items.map((tab) => {
          const isActive = isRouteActive(pathname, tab.path, rootPath);

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

        {hasMoreButton && (
          <button
            type="button"
            onClick={onMorePress}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200 relative',
              isMoreActive
                ? 'text-[#533089]'
                : 'text-[#2E286C]/40 active:text-[#2E286C]/70',
            )}
            aria-label={`${moreLabel} menüsü`}
          >
            {isMoreActive && (
              <span className="absolute top-1.5 w-1 h-1 rounded-full bg-[#533089]" />
            )}
            <MoreIcon
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
              {moreLabel}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}

function isRouteActive(pathname: string, itemPath: string, rootPath: string) {
  return pathname === itemPath || (itemPath !== rootPath && pathname.startsWith(itemPath));
}
