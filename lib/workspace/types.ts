import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/lib/domain';

export type WorkspaceScope = 'admin' | 'student' | 'advisor' | 'teacher';
export type WorkspaceDesktopNav = 'wide' | 'rail';

export type WorkspaceNavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  mobile?: 'tab' | 'more' | 'hidden';
};

export type WorkspaceUserBadge = {
  handle: string;
  initials: string;
  name: string;
  roleLabel: string;
};

export type WorkspaceConfig = {
  accountItems: WorkspaceNavItem[];
  desktopNav: WorkspaceDesktopNav;
  headerTitleFallback: string;
  maxWidthClass: string;
  navItems: WorkspaceNavItem[];
  role: UserRole;
  rootPath: string;
  scope: WorkspaceScope;
  searchPlaceholder?: string;
  user: WorkspaceUserBadge;
};
