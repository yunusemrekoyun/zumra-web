import { getTranslations } from 'next-intl/server';
import {
  BookOpen,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  Presentation,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Avatar,
  Card,
  EmptyState,
  InfoField,
  SectionHeader,
  StatusChip,
} from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { GoogleAccountCard } from '@/components/auth/google-account-card';
import {
  getSessionPrincipal,
  requireWorkspaceRole,
} from '@/lib/server/authorization';
import { googleIdentityService } from '@/lib/server/services/google-identities';
import { getTeacherWorkspaceData } from '@/lib/server/services/teacher-workspace';

type TeacherProfilePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TeacherProfilePage({
  params,
}: TeacherProfilePageProps) {
  const { locale } = await params;
  const uiLocale = locale === 'en' ? 'en' : 'tr';
  const principal = await requireWorkspaceRole('teacher', locale);
  const data = await getTeacherWorkspaceData(principal);
  const [t, workspace, nav, calendar] = await Promise.all([
    getTranslations('teacher.profilePage'),
    getTranslations('workspace.more'),
    getTranslations('workspace.nav'),
    getTranslations('teacher.calendar'),
  ]);

  if (!data.instructor) {
    return (
      <EmptyState
        description={calendar('missingProfileDescription')}
        icon={BookOpen}
        title={calendar('missingProfileTitle')}
      />
    );
  }

  return (
    <div className="workspace-page space-y-4">
      <Card padded className="flex flex-col items-center text-center">
        <Avatar
          name={data.instructor.fullName}
          size="xl"
          className="border-4 border-white shadow-lg mb-4"
        />
        <h1 className="text-xl font-bold text-[#2E286C]">
          {data.instructor.fullName}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <StatusChip tone="purple">{t('role')}</StatusChip>
        </div>

        <div className="w-full h-px bg-black/[0.03] my-6" />

        <div className="text-left w-full space-y-4">
          <InfoRow icon={Mail} label={t('email')} value={data.instructor.email} />
          {data.instructor.phone && (
            <InfoRow
              icon={Phone}
              label={t('phone')}
              value={data.instructor.phone}
            />
          )}
          <InfoRow
            icon={Presentation}
            label={t('branches')}
            value={String(data.branches.length)}
          />
          <InfoRow
            icon={Users}
            label={t('students')}
            value={String(data.students.length)}
          />
        </div>
      </Card>

      <GoogleIdentitySection locale={uiLocale} />

      <Card padded={false}>
        <SectionHeader
          title={t('account')}
          className="px-5 pt-5 lg:px-6 lg:pt-6"
        />
        <div className="px-3 pb-4 lg:px-4 lg:pb-5 space-y-0.5">
          <Link
            href="/ogretmen/ayarlar"
            className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[#2E286C] hover:bg-black/[0.02] transition-colors"
          >
            <Settings className="w-5 h-5 text-[#2E286C]/40" />
            <span className="text-[15px] font-medium flex-1">
              {nav('settings')}
            </span>
          </Link>
          <button className="flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl text-[#2E286C] hover:bg-black/[0.02] transition-colors">
            <HelpCircle className="w-5 h-5 text-[#2E286C]/40" />
            <span className="text-[15px] font-medium flex-1 text-left">
              {workspace('support')}
            </span>
          </button>
          <LogoutButton className="flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl text-red-500/80 hover:bg-red-50/50 transition-colors">
            <LogOut className="w-5 h-5 text-red-400" />
            <span className="text-[15px] font-medium flex-1 text-left">
              {workspace('logout')}
            </span>
          </LogoutButton>
        </div>
      </Card>
    </div>
  );
}

async function GoogleIdentitySection({ locale }: { locale: 'tr' | 'en' }) {
  const principal = await getSessionPrincipal();

  if (!principal || principal.role !== 'teacher') {
    return null;
  }

  const [status, t] = await Promise.all([
    googleIdentityService.getStatus(principal.id),
    getTranslations('teacher.googleAccount'),
  ]);

  if (!status.configured) {
    return null;
  }

  return (
    <GoogleAccountCard
      initialStatus={status}
      labels={{
        actionError: t('actionError'),
        connected: t('connected'),
        description: t('description'),
        disconnected: t('disconnected'),
        link: t('link'),
        linkedSuccess: t('linkedSuccess'),
        password: t('password'),
        title: t('title'),
        unlink: t('unlink'),
        unlinkedSuccess: t('unlinkedSuccess'),
        verifiedEmail: t('verifiedEmail'),
      }}
      locale={locale}
    />
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#533089]/5 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#533089]" />
      </div>
      <InfoField className="min-w-0 flex-1" valueClassName="break-all" label={label} value={value} />
    </div>
  );
}
