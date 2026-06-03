'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  TrendingUp,
  MessageSquare,
  CircleUserRound,
  Zap,
  Bell,
} from 'lucide-react';
import { StudentTabBar, StudentRouteTransition } from '@/components/ui';

const menuItems = [
  { name: 'Derslerim', path: '/ogrenci', icon: BookOpen },
  { name: 'İlerleme', path: '/ogrenci/ilerleme', icon: TrendingUp },
  { name: 'Mesajlar', path: '/ogrenci/mesajlar', icon: MessageSquare },
  { name: 'Profil', path: '/ogrenci/profil', icon: CircleUserRound },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh lg:min-h-screen bg-[#EBE9F1] p-0 lg:p-4 flex items-stretch lg:items-center justify-center font-neubau text-[#2E286C]">

      {/* Mobile: Bottom Tab Bar */}
      <StudentTabBar pathname={pathname} />

      <div className="w-full max-w-[1200px] h-dvh lg:h-[calc(100vh-2rem)] bg-[#F8F9FC] rounded-none lg:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(83,48,137,0.15)] flex overflow-hidden border border-white relative">

        {/* Sidebar — Desktop only (minimal, icon-first) */}
        <aside className="w-20 bg-[#F8F9FC] hidden lg:flex flex-col items-center justify-between py-8 border-r border-black/[0.03] z-10 shrink-0">
          <div className="flex flex-col items-center gap-6">
            <div className="w-10 h-10 rounded-xl bg-[#533089] text-white flex items-center justify-center shadow-lg shadow-[#533089]/30 mb-4">
              <Zap className="w-5 h-5 fill-white" />
            </div>

            <nav className="flex flex-col items-center gap-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.path || (item.path !== '/ogrenci' && pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`group flex flex-col items-center gap-1 px-2 py-2.5 rounded-2xl transition-all duration-200 ${
                      isActive
                        ? 'bg-white shadow-sm text-[#533089]'
                        : 'text-[#2E286C]/40 hover:text-[#2E286C]/70 hover:bg-black/[0.02]'
                    }`}
                    title={item.name}
                  >
                    <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
                    <span className={`text-[9px] leading-none tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F4F5F8] relative">
          {/* Header */}
          <header className="h-14 lg:h-20 px-4 sm:px-6 lg:px-10 flex items-center justify-between shrink-0 bg-transparent z-10 w-full gap-3">
            {/* Mobile: Compact logo */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-lg bg-[#533089] text-white flex items-center justify-center shadow-md shadow-[#533089]/20">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <span className="font-rosmatika font-bold text-lg text-[#2E286C] tracking-tight">Zümra</span>
            </div>

            {/* Desktop: Page title */}
            <div className="hidden lg:block">
              <span className="font-rosmatika text-xl font-medium text-[#2E286C]">
                {menuItems.find(m => pathname === m.path || (m.path !== '/ogrenci' && pathname.startsWith(m.path)))?.name ?? 'Derslerim'}
              </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 lg:gap-4 ml-auto">
              <button className="relative w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#2E286C]/40 hover:text-[#533089] transition-colors">
                <Bell className="w-4 h-4" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-white" />
              </button>
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[#533089]/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                <span className="text-[#533089] font-bold text-xs lg:text-sm">ZK</span>
              </div>
            </div>
          </header>

          {/* Page Content — with route transition */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6 lg:pb-10 custom-scrollbar">
            <StudentRouteTransition routeKey={pathname}>
              {children}
            </StudentRouteTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
