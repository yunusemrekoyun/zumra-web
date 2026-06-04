'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bell,
  HelpCircle,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Zap,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { WorkspaceConfig, WorkspaceNavItem } from '@/lib/workspace';
import { LanguageSwitcher } from './language-switcher';
import { DashboardRouteTransition, useDashboardRouteNavigation } from './route-animation-engine';
import { MobileMoreSheet } from './mobile-more-sheet';
import { MobileTabBar } from './mobile-tab-bar';

type WorkspaceShellProps = {
  children: React.ReactNode;
  config: WorkspaceConfig;
};

export function WorkspaceShell({ children, config }: WorkspaceShellProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations();
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const rootSelector = `[data-dashboard-route-root="${config.scope}"]`;
  const { navigateWithTransition, warmRoute } = useDashboardRouteNavigation({
    currentPath: pathname,
    rootSelector,
    warmupHeaders: {
      [`x-${config.scope}-route-warmup`]: '1',
    },
  });

  const mobileTabs = config.navItems
    .filter((item) => item.mobile === 'tab')
    .map((item) => ({
      ...item,
      label: t(item.labelKey),
    }));
  const mobileMoreItems = config.navItems
    .filter((item) => item.mobile === 'more')
    .map((item) => ({
      ...item,
      label: t(item.labelKey),
    }));
  const mobileAccountItems = config.accountItems.map((item) => ({
    ...item,
    label: t(item.labelKey),
  }));
  const hasMobileMore = mobileMoreItems.length > 0 || mobileAccountItems.length > 0;
  const activeTitleKey =
    [...config.navItems, ...config.accountItems].find((item) =>
      isRouteActive(pathname, item.path, config.rootPath),
    )?.labelKey ?? config.headerTitleKey;
  const activeTitle = t(activeTitleKey);
  const searchPlaceholder = config.searchPlaceholderKey
    ? t(config.searchPlaceholderKey)
    : undefined;

  const sheetLabels = useMemo(
    () => ({
      account: t('workspace.more.account'),
      close: t('workspace.more.close'),
      logout: t('workspace.more.logout'),
      modules: t('workspace.more.modules'),
      support: t('workspace.more.support'),
    }),
    [t],
  );

  return (
    <div className="min-h-dvh lg:min-h-screen bg-[#EBE9F1] p-0 lg:p-4 flex items-stretch lg:items-center justify-center font-neubau text-[#2E286C]">
      <MobileTabBar
        items={mobileTabs}
        pathname={pathname}
        rootPath={config.rootPath}
        navigateWithTransition={navigateWithTransition}
        warmRoute={warmRoute}
        onMorePress={hasMobileMore ? () => setIsMoreSheetOpen(true) : undefined}
        moreLabel={t('workspace.more.title')}
        navLabel={t('workspace.mobileNav')}
      />

      {hasMobileMore && (
        <MobileMoreSheet
          isOpen={isMoreSheetOpen}
          moduleItems={mobileMoreItems}
          accountItems={mobileAccountItems}
          onClose={() => setIsMoreSheetOpen(false)}
          pathname={pathname}
          rootPath={config.rootPath}
          title={t('workspace.more.title')}
          labels={sheetLabels}
          navigateWithTransition={navigateWithTransition}
          warmRoute={warmRoute}
        />
      )}

      <div
        className={cn(
          'w-full h-dvh lg:h-[calc(100vh-2rem)] bg-[#F8F9FC] rounded-none lg:rounded-[2.5rem]',
          'shadow-[0_20px_60px_-15px_rgba(83,48,137,0.15)] flex overflow-hidden border border-white relative',
          config.maxWidthClass,
        )}
      >
        <WorkspaceSidebar
          accountItems={config.accountItems}
          desktopNav={config.desktopNav}
          navItems={config.navItems}
          navigateWithTransition={navigateWithTransition}
          pathname={pathname}
            rootPath={config.rootPath}
            warmRoute={warmRoute}
          />

        <div className="flex-1 flex flex-col min-w-0 bg-[#F4F5F8] relative">
          <header
            className={cn(
              'h-14 px-4 sm:px-6 lg:px-10 flex items-center justify-between shrink-0 bg-transparent z-10 w-full gap-3',
              config.desktopNav === 'wide' ? 'lg:h-24' : 'lg:h-20',
            )}
          >
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-lg bg-[#533089] text-white flex items-center justify-center shadow-md shadow-[#533089]/20">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <span className="font-rosmatika font-bold text-lg text-[#2E286C] tracking-tight">Zümra</span>
            </div>

            {searchPlaceholder ? (
              <div className="relative group hidden md:block w-full max-w-sm lg:w-96">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#2E286C]/40 group-focus-within:text-[#533089] transition-colors" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  className="w-full h-11 bg-white rounded-2xl pl-11 pr-4 outline-none text-sm placeholder:text-[#2E286C]/30 text-[#2E286C] shadow-sm border border-transparent focus:border-[#533089]/20 focus:shadow-md transition-all font-medium"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold text-[#2E286C]/30 bg-black/5 rounded">
                    ⌘
                  </kbd>
                  <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold text-[#2E286C]/30 bg-black/5 rounded">
                    K
                  </kbd>
                </div>
              </div>
            ) : (
              <div className="hidden lg:block">
                <span className="font-rosmatika text-xl font-medium text-[#2E286C]">
                  {activeTitle}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 lg:gap-6 ml-auto">
              <LanguageSwitcher variant="workspace" className="hidden sm:inline-flex" />
              {config.desktopNav === 'wide' && (
                <button
                  type="button"
                  aria-label={t('workspace.header.messages')}
                  className="relative w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#2E286C]/40 hover:text-[#533089] transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={t('workspace.header.notifications')}
                className="relative w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#2E286C]/40 hover:text-[#533089] transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 lg:w-3 lg:h-3 bg-red-400 rounded-full border-2 border-white" />
              </button>

              <div className="flex items-center gap-3 cursor-pointer pl-3 lg:pl-4 border-l border-black/[0.05]">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-[#2E286C]">{config.user.name}</div>
                  <div className="text-xs text-[#2E286C]/50 font-medium">{config.user.handle}</div>
                </div>
                <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[#533089]/10 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                  <span className="text-[#533089] font-bold text-xs lg:text-sm">
                    {config.user.initials}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 sm:px-6 lg:px-10 pb-6 lg:pb-10 custom-scrollbar">
            <DashboardRouteTransition routeKey={`${locale}:${pathname}`} scope={config.scope}>
              {children}
            </DashboardRouteTransition>
          </main>
        </div>
      </div>
    </div>
  );
}

type WorkspaceSidebarProps = {
  accountItems: WorkspaceNavItem[];
  desktopNav: WorkspaceConfig['desktopNav'];
  navItems: WorkspaceNavItem[];
  navigateWithTransition: (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => void;
  pathname: string;
  rootPath: string;
  warmRoute: (targetPath: string) => void;
};

function WorkspaceSidebar({
  accountItems,
  desktopNav,
  navItems,
  navigateWithTransition,
  pathname,
  rootPath,
  warmRoute,
}: WorkspaceSidebarProps) {
  const t = useTranslations();

  if (desktopNav === 'rail') {
    return (
      <aside className="w-20 bg-[#F8F9FC] hidden lg:flex flex-col items-center justify-between py-8 border-r border-black/[0.03] z-10 shrink-0">
        <div className="flex flex-col items-center gap-6">
          <WorkspaceLogo compact />
          <nav className="flex flex-col items-center gap-2">
            {navItems.map((item) => (
              <RailNavLink
                key={item.path}
                item={item}
                navigateWithTransition={navigateWithTransition}
                pathname={pathname}
                rootPath={rootPath}
                warmRoute={warmRoute}
              />
            ))}
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-[#F8F9FC] hidden lg:flex flex-col justify-between py-8 px-6 border-r border-black/[0.03] z-10 shrink-0">
      <div>
        <WorkspaceLogo />
        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <WideNavLink
              key={item.path}
              item={item}
              navigateWithTransition={navigateWithTransition}
              pathname={pathname}
              rootPath={rootPath}
              warmRoute={warmRoute}
            />
          ))}
        </nav>
      </div>

      <div className="space-y-1.5">
        {accountItems.map((item) => (
          <WideNavLink
            key={item.path}
            item={item}
            navigateWithTransition={navigateWithTransition}
            pathname={pathname}
            rootPath={rootPath}
            warmRoute={warmRoute}
            fallbackIcon={Settings}
          />
        ))}
        <button className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all font-medium text-[14px] text-[#2E286C]/60 hover:bg-black/[0.02]">
          <HelpCircle className="w-5 h-5 text-[#2E286C]/40" /> {t('workspace.more.support')}
        </button>
        <button className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all font-medium text-[14px] text-red-500/70 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-5 h-5 text-red-400" /> {t('workspace.more.logout')}
        </button>
      </div>
    </aside>
  );
}

function WorkspaceLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#533089] text-white flex items-center justify-center shadow-lg shadow-[#533089]/30 mb-4">
        <Zap className="w-5 h-5 fill-white" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-10 pl-2">
      <div className="w-8 h-8 rounded-xl bg-[#533089] text-white flex items-center justify-center shadow-lg shadow-[#533089]/30">
        <Zap className="w-5 h-5 fill-white" />
      </div>
      <span className="font-rosmatika font-bold text-2xl text-[#2E286C] tracking-tight">Zümra</span>
    </div>
  );
}

type NavLinkProps = {
  fallbackIcon?: typeof Settings;
  item: WorkspaceNavItem;
  navigateWithTransition: (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => void;
  pathname: string;
  rootPath: string;
  warmRoute: (targetPath: string) => void;
};

function WideNavLink({
  fallbackIcon,
  item,
  navigateWithTransition,
  pathname,
  rootPath,
  warmRoute,
}: NavLinkProps) {
  const t = useTranslations();
  const Icon = item.icon ?? fallbackIcon ?? Settings;
  const isActive = isRouteActive(pathname, item.path, rootPath);

  return (
    <Link
      href={item.path as never}
      onClick={(event) => navigateWithTransition(event, item.path)}
      onFocus={() => warmRoute(item.path)}
      onMouseEnter={() => warmRoute(item.path)}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all duration-300 font-medium text-[14px]',
        isActive
          ? 'bg-white shadow-sm text-[#533089] font-bold'
          : 'text-[#2E286C]/60 hover:bg-black/[0.02] hover:text-[#2E286C]',
      )}
    >
      <Icon className={cn('w-5 h-5', isActive ? 'text-[#533089]' : 'text-[#2E286C]/40')} />
      {t(item.labelKey)}
    </Link>
  );
}

function RailNavLink({
  item,
  navigateWithTransition,
  pathname,
  rootPath,
  warmRoute,
}: NavLinkProps) {
  const t = useTranslations();
  const isActive = isRouteActive(pathname, item.path, rootPath);
  const label = t(item.labelKey);

  return (
    <Link
      href={item.path as never}
      onClick={(event) => navigateWithTransition(event, item.path)}
      onFocus={() => warmRoute(item.path)}
      onMouseEnter={() => warmRoute(item.path)}
      className={cn(
        'group flex flex-col items-center gap-1 px-2 py-2.5 rounded-2xl transition-all duration-200',
        isActive
          ? 'bg-white shadow-sm text-[#533089]'
          : 'text-[#2E286C]/40 hover:text-[#2E286C]/70 hover:bg-black/[0.02]',
      )}
      title={label}
    >
      <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
      <span className={cn('text-[9px] leading-none tracking-wide', isActive ? 'font-bold' : 'font-medium')}>
        {label}
      </span>
    </Link>
  );
}

function isRouteActive(pathname: string, itemPath: string, rootPath: string) {
  return pathname === itemPath || (itemPath !== rootPath && pathname.startsWith(itemPath));
}
