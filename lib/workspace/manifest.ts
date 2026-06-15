import type { UserRole } from '@/lib/domain';
import type { WorkspaceDesktopNav, WorkspaceScope, WorkspaceUserBadge } from './types';

export type WorkspaceIconKey =
  | 'barChart'
  | 'book'
  | 'calendar'
  | 'creditCard'
  | 'dashboard'
  | 'messages'
  | 'presentation'
  | 'profile'
  | 'settings'
  | 'students'
  | 'target'
  | 'trending'
  | 'userCheck'
  | 'users';

export type WorkspaceModuleKind = 'account' | 'nav';

export type WorkspaceModuleDefinition = {
  iconKey: WorkspaceIconKey;
  kind: WorkspaceModuleKind;
  labelKey: string;
  mobile?: 'hidden' | 'more' | 'tab';
  path: string;
  scope: WorkspaceScope;
};

export type WorkspaceShellDefinition = {
  desktopNav: WorkspaceDesktopNav;
  headerTitleKey: string;
  maxWidthClass: string;
  role: UserRole;
  rootPath: string;
  searchPlaceholderKey?: string;
  user: WorkspaceUserBadge;
};

export const workspaceShells = {
  admin: {
    role: 'admin',
    rootPath: '/admin',
    maxWidthClass: 'max-w-[1600px]',
    desktopNav: 'wide',
    headerTitleKey: 'admin.nav.dashboard',
    searchPlaceholderKey: 'admin.shell.searchPlaceholder',
    user: {
      name: 'Yunus Emre',
      handle: '@yunus_admin',
      initials: 'YE',
      roleLabelKey: 'workspace.roles.admin',
    },
  },
  advisor: {
    role: 'advisor',
    rootPath: '/danisman',
    maxWidthClass: 'max-w-[1400px]',
    desktopNav: 'wide',
    headerTitleKey: 'advisor.nav.overview',
    searchPlaceholderKey: 'advisor.shell.searchPlaceholder',
    user: {
      name: 'Aylin Karaca',
      handle: '@aylin_danisman',
      initials: 'AK',
      roleLabelKey: 'workspace.roles.advisor',
    },
  },
  student: {
    role: 'student',
    rootPath: '/ogrenci',
    maxWidthClass: 'max-w-[1200px]',
    desktopNav: 'rail',
    headerTitleKey: 'student.nav.lessons',
    user: {
      name: 'Zeynep Kaya',
      handle: '@zeynep',
      initials: 'ZK',
      roleLabelKey: 'workspace.roles.student',
    },
  },
  teacher: {
    role: 'teacher',
    rootPath: '/ogretmen',
    maxWidthClass: 'max-w-[1200px]',
    desktopNav: 'rail',
    headerTitleKey: 'teacher.nav.lessons',
    user: {
      name: 'Sarah Lee',
      handle: '@sarah_teacher',
      initials: 'SL',
      roleLabelKey: 'workspace.roles.teacher',
    },
  },
} satisfies Record<WorkspaceScope, WorkspaceShellDefinition>;

export const workspaceModules = [
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.dashboard', path: '/admin', iconKey: 'dashboard', mobile: 'tab' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.leads', path: '/admin/leads', iconKey: 'users', mobile: 'tab' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.calendar', path: '/admin/calendar', iconKey: 'calendar', mobile: 'tab' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.students', path: '/admin/students', iconKey: 'students', mobile: 'tab' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.instructors', path: '/admin/instructors', iconKey: 'presentation', mobile: 'more' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.programs', path: '/admin/programs', iconKey: 'book', mobile: 'more' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.messages', path: '/admin/messages', iconKey: 'messages', mobile: 'more' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.payments', path: '/admin/payments', iconKey: 'creditCard', mobile: 'more' },
  { scope: 'admin', kind: 'nav', labelKey: 'admin.nav.reports', path: '/admin/reports', iconKey: 'barChart', mobile: 'more' },
  { scope: 'admin', kind: 'account', labelKey: 'workspace.nav.settings', path: '/admin/settings', iconKey: 'settings', mobile: 'more' },

  { scope: 'student', kind: 'nav', labelKey: 'student.nav.lessons', path: '/ogrenci', iconKey: 'book', mobile: 'tab' },
  { scope: 'student', kind: 'nav', labelKey: 'student.nav.progress', path: '/ogrenci/ilerleme', iconKey: 'trending', mobile: 'tab' },
  { scope: 'student', kind: 'nav', labelKey: 'student.nav.messages', path: '/ogrenci/mesajlar', iconKey: 'messages', mobile: 'tab' },
  { scope: 'student', kind: 'nav', labelKey: 'student.nav.profile', path: '/ogrenci/profil', iconKey: 'profile', mobile: 'tab' },

  { scope: 'advisor', kind: 'nav', labelKey: 'advisor.nav.overview', path: '/danisman', iconKey: 'dashboard', mobile: 'tab' },
  { scope: 'advisor', kind: 'nav', labelKey: 'advisor.nav.leads', path: '/danisman/leadler', iconKey: 'users', mobile: 'tab' },
  { scope: 'advisor', kind: 'nav', labelKey: 'advisor.nav.students', path: '/danisman/ogrenciler', iconKey: 'students', mobile: 'tab' },
  { scope: 'advisor', kind: 'nav', labelKey: 'advisor.nav.meetings', path: '/danisman/gorusmeler', iconKey: 'calendar', mobile: 'tab' },
  { scope: 'advisor', kind: 'nav', labelKey: 'advisor.nav.offers', path: '/danisman/teklifler', iconKey: 'target', mobile: 'more' },
  { scope: 'advisor', kind: 'nav', labelKey: 'advisor.nav.messages', path: '/danisman/mesajlar', iconKey: 'messages', mobile: 'more' },
  { scope: 'advisor', kind: 'account', labelKey: 'workspace.nav.settings', path: '/danisman/ayarlar', iconKey: 'settings', mobile: 'more' },

  { scope: 'teacher', kind: 'nav', labelKey: 'teacher.nav.lessons', path: '/ogretmen', iconKey: 'book', mobile: 'tab' },
  { scope: 'teacher', kind: 'nav', labelKey: 'teacher.nav.students', path: '/ogretmen/ogrenciler', iconKey: 'students', mobile: 'tab' },
  { scope: 'teacher', kind: 'nav', labelKey: 'teacher.nav.calendar', path: '/ogretmen/takvim', iconKey: 'calendar', mobile: 'tab' },
  { scope: 'teacher', kind: 'nav', labelKey: 'teacher.nav.messages', path: '/ogretmen/mesajlar', iconKey: 'messages', mobile: 'tab' },
  { scope: 'teacher', kind: 'nav', labelKey: 'teacher.nav.profile', path: '/ogretmen/profil', iconKey: 'userCheck', mobile: 'more' },
  { scope: 'teacher', kind: 'account', labelKey: 'workspace.nav.settings', path: '/ogretmen/ayarlar', iconKey: 'settings', mobile: 'more' },
] satisfies WorkspaceModuleDefinition[];

export const workspaceExtraRoutes = [
  '/aktivasyon',
  '/cihaz-dogrulama',
  '/giris',
  '/mfa',
  '/mfa-kurulum',
  '/sifremi-unuttum',
  '/sifre-sifirla',
  '/yetkisiz',
  '/admin/students/[studentId]',
  '/admin/instructors/[instructorId]',
  '/admin/students/1',
  '/admin/leads/[candidateId]/enrollment',
  '/ogrenci/dersler',
] as const;

export const workspacePathnames = Object.fromEntries(
  ['/', ...workspaceModules.map((item) => item.path), ...workspaceExtraRoutes]
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .map((path) => [path, path]),
) as Record<string, string | Record<'en' | 'tr', string>>;

workspacePathnames['/level-test'] = {
  en: '/level-test',
  tr: '/seviye-testi',
};
