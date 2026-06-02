'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutGrid, 
  Users, 
  GraduationCap, 
  Presentation, 
  BookOpen, 
  Calendar, 
  MessageSquare, 
  CreditCard, 
  BarChart2, 
  Settings,
  Bell,
  Search,
  Menu,
  LogOut,
  HelpCircle,
  Zap
} from 'lucide-react';
import { AdminDrawer } from './_components/admin-drawer';
import { AdminRouteTransition, useAdminRouteNavigation } from './_components/admin-route-transition';

const menuItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutGrid },
  { name: 'Leadler', path: '/admin/leads', icon: Users },
  { name: 'Öğrenciler', path: '/admin/students', icon: GraduationCap },
  { name: 'Eğitmenler', path: '/admin/instructors', icon: Presentation },
  { name: 'Programlar', path: '/admin/programs', icon: BookOpen },
  { name: 'Takvim', path: '/admin/calendar', icon: Calendar },
  { name: 'Mesajlar', path: '/admin/messages', icon: MessageSquare },
  { name: 'Ödemeler', path: '/admin/payments', icon: CreditCard },
  { name: 'Raporlar', path: '/admin/reports', icon: BarChart2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { navigateWithTransition, warmRoute } = useAdminRouteNavigation(pathname);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:min-h-screen bg-[#EBE9F1] p-0 lg:p-4 flex items-stretch lg:items-center justify-center font-neubau text-[#2E286C]">
      <AdminDrawer
        isOpen={isDrawerOpen}
        menuItems={menuItems}
        navigateWithTransition={navigateWithTransition}
        onClose={() => setIsDrawerOpen(false)}
        pathname={pathname}
        warmRoute={warmRoute}
      />

      <div className="w-full max-w-[1600px] h-dvh lg:h-[calc(100vh-2rem)] bg-[#F8F9FC] rounded-none lg:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(83,48,137,0.15)] flex overflow-hidden border border-white relative">
        
        {/* Sidebar */}
        <aside className="w-64 bg-[#F8F9FC] hidden lg:flex flex-col justify-between py-8 px-6 border-r border-black/[0.03] z-10 shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-10 pl-2">
              <div className="w-8 h-8 rounded-xl bg-[#533089] text-white flex items-center justify-center shadow-lg shadow-[#533089]/30">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              <span className="font-rosmatika font-bold text-2xl text-[#2E286C] tracking-tight">Zümra</span>
            </div>

            <nav className="space-y-1.5">
              {menuItems.map((item) => {
                const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));
                return (
                  <Link 
                    key={item.name} 
                    href={item.path}
                    onClick={(event) => navigateWithTransition(event, item.path)}
                    onFocus={() => warmRoute(item.path)}
                    onMouseEnter={() => warmRoute(item.path)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all duration-300 font-medium text-[14px] ${
                      isActive 
                        ? 'bg-white shadow-sm text-[#533089] font-bold' 
                        : 'text-[#2E286C]/60 hover:bg-black/[0.02] hover:text-[#2E286C]'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-[#533089]' : 'text-[#2E286C]/40'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-1.5">
            <Link href="/admin/settings" onClick={(event) => navigateWithTransition(event, '/admin/settings')} onFocus={() => warmRoute('/admin/settings')} onMouseEnter={() => warmRoute('/admin/settings')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all font-medium text-[14px] ${pathname === '/admin/settings' ? 'bg-white shadow-sm text-[#533089]' : 'text-[#2E286C]/60 hover:bg-black/[0.02]'}`}>
              <Settings className="w-5 h-5 text-[#2E286C]/40" /> Ayarlar
            </Link>
            <button className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all font-medium text-[14px] text-[#2E286C]/60 hover:bg-black/[0.02]">
              <HelpCircle className="w-5 h-5 text-[#2E286C]/40" /> Destek
            </button>
            <button className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all font-medium text-[14px] text-red-500/70 hover:bg-red-50 hover:text-red-600">
              <LogOut className="w-5 h-5 text-red-400" /> Çıkış Yap
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F4F5F8] relative">
          {/* Header */}
          <header className="h-16 lg:h-24 px-4 sm:px-6 lg:px-10 flex items-center justify-between shrink-0 bg-transparent z-10 w-full gap-3">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                aria-label="Menüyü aç"
                onClick={() => setIsDrawerOpen(true)}
                className="touch-button flex items-center justify-center rounded-2xl bg-white text-[#2E286C]/60 shadow-sm"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#533089] text-white flex items-center justify-center shadow-lg shadow-[#533089]/20">
                  <Zap className="w-5 h-5 fill-white" />
                </div>
                <span className="hidden sm:inline font-rosmatika font-bold text-2xl text-[#2E286C] tracking-tight">Zümra</span>
              </div>
            </div>

            <div className="relative group hidden md:block w-full max-w-sm lg:w-96">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#2E286C]/40 group-focus-within:text-[#533089] transition-colors" />
              <input 
                type="text" 
                placeholder="Öğrenci, eğitmen veya mesaj ara..." 
                className="w-full h-11 bg-white rounded-2xl pl-11 pr-4 outline-none text-sm placeholder:text-[#2E286C]/30 text-[#2E286C] shadow-sm border border-transparent focus:border-[#533089]/20 focus:shadow-md transition-all font-medium"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold text-[#2E286C]/30 bg-black/5 rounded">⌘</kbd>
                <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold text-[#2E286C]/30 bg-black/5 rounded">K</kbd>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-6 ml-auto">
              <button className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#2E286C]/40 hover:text-[#533089] transition-colors">
                <MessageSquare className="w-4 h-4" />
              </button>
              <button className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#2E286C]/40 hover:text-[#533089] transition-colors">
                <Bell className="w-4 h-4" />
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-400 rounded-full border-2 border-white" />
              </button>
              
              <div className="flex items-center gap-3 cursor-pointer pl-4 border-l border-black/[0.05]">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-[#2E286C]">Yunus Emre</div>
                  <div className="text-xs text-[#2E286C]/50 font-medium">@yunus_admin</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#533089]/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                  <span className="text-[#533089] font-bold text-sm">YE</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6 lg:pb-10 custom-scrollbar">
            <AdminRouteTransition routeKey={pathname}>
              {children}
            </AdminRouteTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
