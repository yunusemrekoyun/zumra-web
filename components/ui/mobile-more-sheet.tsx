'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  HelpCircle,
  LogOut,
  ChevronRight,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { LogoutButton } from '@/components/auth/logout-button';

export type SheetMenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

type MobileMoreSheetProps = {
  accountItems?: SheetMenuItem[];
  isOpen: boolean;
  moduleItems?: SheetMenuItem[];
  navigateWithTransition: (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => void;
  onClose: () => void;
  pathname: string;
  rootPath: string;
  title?: string;
  labels?: {
    account: string;
    close: string;
    logout: string;
    modules: string;
    support: string;
  };
  warmRoute: (targetPath: string) => void;
};

export function MobileMoreSheet({
  accountItems = [],
  isOpen,
  moduleItems = [],
  navigateWithTransition,
  onClose,
  pathname,
  rootPath,
  title = 'Account',
  labels = {
    account: 'Account',
    close: 'Close menu',
    logout: 'Log Out',
    modules: 'Modules',
    support: 'Support',
  },
  warmRoute,
}: MobileMoreSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape key closes sheet */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  /* Lock body scroll when open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavigate = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
      onClose();
      navigateWithTransition(e, path);
    },
    [onClose, navigateWithTransition],
  );

  const renderItem = (item: SheetMenuItem) => {
    const isActive = isRouteActive(pathname, item.path, rootPath);

    return (
      <Link
        key={item.path}
        href={item.path as never}
        prefetch={false}
        onClick={(e) => handleNavigate(e, item.path)}
        onMouseEnter={() => warmRoute(item.path)}
        onFocus={() => warmRoute(item.path)}
        className={cn(
          'flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-colors duration-200 active:bg-black/[0.04]',
          isActive
            ? 'bg-white shadow-sm text-[#533089] font-bold'
            : 'text-[#2E286C] hover:bg-black/[0.02]',
        )}
      >
        <item.icon
          className={cn(
            'w-5 h-5 shrink-0',
            isActive ? 'text-[#533089]' : 'text-[#2E286C]/40',
          )}
        />
        <span className="flex-1 text-[15px] font-medium">{item.label}</span>
        <ChevronRight className="w-4 h-4 text-[#2E286C]/20 shrink-0" />
      </Link>
    );
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] lg:hidden',
        isOpen ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!isOpen}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className={cn(
          'mobile-sheet-overlay',
          isOpen ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="mobile-sheet-panel"
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          maxHeight: '80dvh',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#2E286C]/10" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-2">
          <h2 className="font-rosmatika text-xl font-medium text-[#2E286C]">
            {title}
          </h2>
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="touch-button flex items-center justify-center rounded-2xl bg-white text-[#2E286C]/60 shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto custom-scrollbar px-3 pb-6" style={{ maxHeight: 'calc(80dvh - 6rem)' }}>
          {/* Modules section */}
          {moduleItems.length > 0 && (
            <div className="mb-2">
              <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
                {labels.modules}
              </p>
              <div className="space-y-0.5">
                {moduleItems.map(renderItem)}
              </div>
            </div>
          )}

          {/* Divider */}
          {moduleItems.length > 0 && <div className="mx-5 my-3 h-px bg-black/[0.04]" />}

          {/* Account section */}
          <div>
            <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/40">
              {labels.account}
            </p>
            <div className="space-y-0.5">
              {accountItems.map(renderItem)}

              {/* Support — not a Link, just a button */}
              <button
                type="button"
                className="flex w-full items-center gap-4 px-5 py-3.5 rounded-2xl text-[#2E286C] transition-colors duration-200 active:bg-black/[0.04] hover:bg-black/[0.02]"
              >
                <HelpCircle className="w-5 h-5 text-[#2E286C]/40 shrink-0" />
                <span className="flex-1 text-left text-[15px] font-medium">{labels.support}</span>
                <ChevronRight className="w-4 h-4 text-[#2E286C]/20 shrink-0" />
              </button>

              {/* Logout */}
              <LogoutButton
                onLogout={onClose}
                className="flex w-full items-center gap-4 px-5 py-3.5 rounded-2xl text-red-500/80 transition-colors duration-200 active:bg-red-50 hover:bg-red-50/50"
              >
                <LogOut className="w-5 h-5 text-red-400 shrink-0" />
                <span className="flex-1 text-left text-[15px] font-medium">{labels.logout}</span>
              </LogoutButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function isRouteActive(pathname: string, itemPath: string, rootPath: string) {
  return pathname === itemPath || (itemPath !== rootPath && pathname.startsWith(itemPath));
}
