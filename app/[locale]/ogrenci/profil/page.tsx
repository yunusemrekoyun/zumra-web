import { getTranslations } from 'next-intl/server';
import {
  Card,
  EmptyState,
  InfoField,
  SectionHeader,
  StaggerContainer,
  StaggerItem,
  StatusChip,
} from '@/components/ui';
import {
  BookOpen,
  Calendar,
  GraduationCap,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  Presentation,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { ProfilePhotoUploader } from '@/components/profile-photo-uploader';
import { GoogleAccountCard } from '@/components/auth/google-account-card';
import {
  getSessionPrincipal,
  requireWorkspaceRole,
} from '@/lib/server/authorization';
import { googleIdentityService } from '@/lib/server/services/google-identities';
import { getProfilePhotoUrl } from '@/lib/server/services/profile-photo';
import { getStudentWorkspaceData } from '@/lib/server/services/student-workspace';

const KNOWN_STATUS = new Set([
  'active',
  'paused',
  'graduated',
  'cancelled',
  'candidate',
]);

type StudentProfilePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StudentProfilePage({
  params,
}: StudentProfilePageProps) {
  const { locale } = await params;
  const uiLocale = locale === 'en' ? 'en' : 'tr';
  const principal = await requireWorkspaceRole('student', locale);
  const [data, photoUrl] = await Promise.all([
    getStudentWorkspaceData(principal),
    getProfilePhotoUrl(principal.id),
  ]);
  const [t, workspace, commonStatus, calendar] = await Promise.all([
    getTranslations('student.profilePage'),
    getTranslations('workspace.more'),
    getTranslations('common.status'),
    getTranslations('student.calendar'),
  ]);

  if (!data.student) {
    return (
      <EmptyState
        description={calendar('missingProfileDescription')}
        icon={BookOpen}
        title={calendar('missingProfileTitle')}
      />
    );
  }

  const programLabel =
    data.enrollment?.programName ?? data.enrollment?.language ?? '—';
  const level =
    data.student.currentLevel ?? data.enrollment?.currentLevel ?? '—';
  const enrolledAt = data.enrollment
    ? formatEnrollmentDate(data.enrollment.enrolledAt, locale)
    : '—';
  const courseModeLabel = data.enrollment
    ? t(`courseModes.${data.enrollment.courseMode}`)
    : '—';
  const statusKey = KNOWN_STATUS.has(data.student.status)
    ? data.student.status
    : 'active';

  return (
    <StaggerContainer className="admin-page">
      {/* Profile header */}
      <StaggerItem>
        <Card padded className="flex flex-col items-center text-center">
          <div className="mb-4">
            <ProfilePhotoUploader
              name={data.student.fullName}
              photoUrl={photoUrl}
            />
          </div>
          <h1 className="text-xl font-bold text-[#2E286C]">
            {data.student.fullName}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusChip tone={statusKey === 'active' ? 'emerald' : 'amber'}>
              {commonStatus(statusKey)}
            </StatusChip>
          </div>

          <div className="w-full h-px bg-black/[0.03] my-6" />

          <div className="text-left w-full space-y-4">
            <InfoRow icon={Mail} label={t('email')} value={data.student.email} />
            {data.student.phone && (
              <InfoRow icon={Phone} label={t('phone')} value={data.student.phone} />
            )}
            <InfoRow icon={BookOpen} label={t('program')} value={programLabel} />
            {data.enrollment?.branchName && (
              <InfoRow
                icon={Presentation}
                label={t('branch')}
                value={data.enrollment.branchName}
              />
            )}
            {data.enrollment && (
              <InfoRow
                icon={Users}
                label={t('courseMode')}
                value={courseModeLabel}
              />
            )}
            <InfoRow
              icon={GraduationCap}
              label={t('level')}
              value={level}
            />
            <InfoRow
              icon={Calendar}
              label={t('enrollmentDate')}
              value={enrolledAt}
            />
          </div>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <GoogleIdentitySection locale={uiLocale} />
      </StaggerItem>

      {/* Account menu */}
      <StaggerItem>
        <Card padded={false}>
          <SectionHeader
            title={t('account')}
            className="px-5 pt-5 lg:px-6 lg:pt-6"
          />
          <div className="px-3 pb-4 lg:px-4 lg:pb-5 space-y-0.5">
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
      </StaggerItem>
    </StaggerContainer>
  );
}

async function GoogleIdentitySection({ locale }: { locale: 'tr' | 'en' }) {
  const principal = await getSessionPrincipal();

  if (!principal || principal.role !== 'student') {
    return null;
  }

  const [status, t] = await Promise.all([
    googleIdentityService.getStatus(principal.id),
    getTranslations('student.googleAccount'),
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
      <InfoField className="min-w-0 flex-1" label={label} value={value} valueClassName="break-all" />
    </div>
  );
}

function formatEnrollmentDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}
