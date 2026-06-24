import {
  BarChart2,
  BookOpen,
  Calendar,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  GraduationCap,
  HardDrive,
  LayoutGrid,
  MessageSquare,
  Presentation,
  Settings,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { workspaceModules, workspaceShells, type WorkspaceIconKey, type WorkspaceModuleKind } from './manifest';
import type { WorkspaceConfig, WorkspaceNavItem, WorkspaceScope } from './types';

const icons: Record<WorkspaceIconKey, LucideIcon> = {
  barChart: BarChart2,
  book: BookOpen,
  calendar: Calendar,
  clipboard: ClipboardList,
  creditCard: CreditCard,
  dashboard: LayoutGrid,
  hardDrive: HardDrive,
  messages: MessageSquare,
  presentation: Presentation,
  profile: CircleUserRound,
  settings: Settings,
  students: GraduationCap,
  target: Target,
  trending: TrendingUp,
  userCheck: UserCheck,
  users: Users,
};

const navItemsFor = (scope: WorkspaceScope, kind: WorkspaceModuleKind): WorkspaceNavItem[] =>
  workspaceModules
    .filter((item) => item.scope === scope && item.kind === kind)
    .map((item) => ({
      icon: icons[item.iconKey],
      labelKey: item.labelKey,
      mobile: item.mobile,
      path: item.path,
    }));

const buildWorkspaceConfig = (scope: WorkspaceScope): WorkspaceConfig => ({
  ...workspaceShells[scope],
  accountItems: navItemsFor(scope, 'account'),
  navItems: navItemsFor(scope, 'nav'),
  scope,
});

export const workspaceConfigs = {
  admin: buildWorkspaceConfig('admin'),
  advisor: buildWorkspaceConfig('advisor'),
  student: buildWorkspaceConfig('student'),
  teacher: buildWorkspaceConfig('teacher'),
} satisfies Record<WorkspaceScope, WorkspaceConfig>;

export type WorkspaceConfigKey = keyof typeof workspaceConfigs;
