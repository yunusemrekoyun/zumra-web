'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { HelpCircle, LogOut, Settings, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdminMenuItem = {
  icon: LucideIcon;
  name: string;
  path: string;
};

type AdminDrawerProps = {
  isOpen: boolean;
  menuItems: AdminMenuItem[];
  navigateWithTransition: (event: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => void;
  onClose: () => void;
  pathname: string;
  warmRoute: (targetPath: string) => void;
};

export function AdminDrawer({
  isOpen,
  menuItems,
  navigateWithTransition,
  onClose,
  pathname,
  warmRoute,
}: AdminDrawerProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 lg:hidden',
        isOpen ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Menüyü kapat"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-[#2E286C]/25 backdrop-blur-sm transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0',
        )}
      />
      <aside
        className={cn(
          'absolute left-0 top-0 flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col justify-between border-r border-black/[0.03] bg-[#F8F9FC] px-5 py-6 shadow-2xl shadow-[#2E286C]/20 transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#533089] text-white shadow-lg shadow-[#533089]/30">
                <Zap className="h-5 w-5 fill-white" />
              </div>
              <span className="font-rosmatika text-2xl font-bold tracking-tight text-[#2E286C]">Zümra</span>
            </div>
            <button
              type="button"
              aria-label="Menüyü kapat"
              onClick={onClose}
              className="touch-button flex items-center justify-center rounded-2xl bg-white text-[#2E286C]/60 shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={(event) => {
                    onClose();
                    navigateWithTransition(event, item.path);
                  }}
                  onFocus={() => warmRoute(item.path)}
                  onMouseEnter={() => warmRoute(item.path)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-medium transition-all',
                    isActive
                      ? 'bg-white font-bold text-[#533089] shadow-sm'
                      : 'text-[#2E286C]/60 hover:bg-black/[0.02] hover:text-[#2E286C]',
                  )}
                >
                  <item.icon className={cn('h-5 w-5', isActive ? 'text-[#533089]' : 'text-[#2E286C]/40')} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1.5">
          <Link
            href="/admin/settings"
            onClick={(event) => {
              onClose();
              navigateWithTransition(event, '/admin/settings');
            }}
            onFocus={() => warmRoute('/admin/settings')}
            onMouseEnter={() => warmRoute('/admin/settings')}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-medium transition-all',
              pathname === '/admin/settings'
                ? 'bg-white text-[#533089] shadow-sm'
                : 'text-[#2E286C]/60 hover:bg-black/[0.02]',
            )}
          >
            <Settings className="h-5 w-5 text-[#2E286C]/40" /> Ayarlar
          </Link>
          <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-medium text-[#2E286C]/60 transition-all hover:bg-black/[0.02]">
            <HelpCircle className="h-5 w-5 text-[#2E286C]/40" /> Destek
          </button>
          <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-medium text-red-500/70 transition-all hover:bg-red-50 hover:text-red-600">
            <LogOut className="h-5 w-5 text-red-400" /> Çıkış Yap
          </button>
        </div>
      </aside>
    </div>
  );
}
