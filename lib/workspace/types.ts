import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/lib/domain';

export type WorkspaceScope = 'admin' | 'student' | 'advisor' | 'teacher';
export type WorkspaceDesktopNav = 'wide' | 'rail';

export type WorkspaceNavItem = {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  mobile?: 'tab' | 'more' | 'hidden';
};

export type WorkspaceUserBadge = {
  handle: string;
  initials: string;
  name: string;
  roleLabelKey: string;
};

export type WorkspaceConfig = {
  accountItems: WorkspaceNavItem[];
  desktopNav: WorkspaceDesktopNav;
  headerTitleKey: string;
  maxWidthClass: string;
  navItems: WorkspaceNavItem[];
  role: UserRole;
  rootPath: string;
  scope: WorkspaceScope;
  searchPlaceholderKey?: string;
  user: WorkspaceUserBadge;
};
