import {
  CalendarDays,
  ChevronLeft,
  Mail,
  MessageSquare,
  UserRoundCheck,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import {
  ActionBar,
  Button,
  Card,
  InfoField,
  ModulePanel,
  StatusChip,
} from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAdminStudentDetail } from '@/lib/server/services/students';

type StudentDetailPageProps = {
  params: Promise<{ locale: string; studentId: string }>;
};

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { locale, studentId } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [detail, t, studentsT, status, domain] = await Promise.all([
    getAdminStudentDetail(principal, studentId),
    getTranslations('admin.studentDetail'),
    getTranslations('admin.students'),
    getTranslations('common.status'),
    getTranslations('domain'),
  ]);

  if (!detail) {
    notFound();
  }

  const dateLocale = locale === 'en' ? 'en-US' : 'tr-TR';
  const statusTone =
    detail.status === 'active'
      ? 'emerald'
      : detail.status === 'graduated'
        ? 'blue'
        : detail.status === 'cancelled'
          ? 'red'
          : 'amber';

  return (
    <div className="admin-page">
      <div className="flex flex-col justify-between gap-4 border-b border-black/[0.03] pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/students"
            aria-label={t('backToStudents')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white transition-colors hover:bg-black/5"
          >
            <ChevronLeft className="h-5 w-5 text-[#2E286C]" />
          </Link>
          <div>
            <h1 className="font-rosmatika text-2xl font-medium text-[#2E286C]">
              {detail.fullName}
            </h1>
            <div className="text-xs font-medium text-[#2E286C]/50">
              {t('studentId')}: #{detail.studentId.slice(0, 8)}
            </div>
          </div>
        </div>
        <ActionBar>
          <Button variant="secondary" size="sm">
            <Mail className="h-4 w-4" /> {t('email')}
          </Button>
          <Button size="sm" className="hover:scale-105">
            <MessageSquare className="h-4 w-4" /> {t('sendMessage')}
          </Button>
        </ActionBar>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
          <ModulePanel className="flex flex-col items-center text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#533089]/10 text-3xl font-bold text-[#533089] shadow-md">
              {getInitials(detail.fullName)}
            </div>
            <h2 className="text-center text-xl font-bold text-[#2E286C]">
              {detail.fullName}
            </h2>
            <StatusChip tone={statusTone} className="mx-auto mt-2">
              {status(detail.status)}
            </StatusChip>

            <div className="my-6 h-px w-full bg-black/[0.03]" />

            <div className="w-full space-y-4 text-left">
              <InfoField
                label={t('registeredProgram')}
                value={formatProgram(detail, domain)}
              />
              <InfoField
                label={t('currentLevel')}
                value={detail.currentLevel ?? '-'}
              />
              <InfoField
                label={t('instructor')}
                value={detail.instructorName ?? studentsT('toAssign')}
                valueClassName="text-[#533089]"
              />
              <InfoField
                label={t('enrollmentDate')}
                value={formatDate(detail.enrolledAt, dateLocale)}
                valueClassName="text-[#2E286C]/70"
              />
            </div>
          </ModulePanel>
        </div>

        <div className="flex flex-1 flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:gap-6">
            <Card variant="gradient" className="group relative overflow-hidden">
              <div className="relative z-10">
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-white/70">
                  {t('account')}
                </div>
                <div className="mb-1 font-rosmatika text-3xl font-medium">
                  {accountStateLabel(detail.accountState, t)}
                </div>
                <div className="text-sm font-bold text-emerald-300">
                  {detail.username ?? t('usernamePending')}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 translate-x-4 translate-y-4 scale-150 opacity-10 transition-transform duration-700 group-hover:scale-110">
                <UserRoundCheck className="h-24 w-24" />
              </div>
            </Card>

            <ModulePanel>
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#2E286C]/50">
                {t('contact')}
              </div>
              <div className="mb-1 truncate text-lg font-bold text-[#2E286C]">
                {detail.email}
              </div>
              <div className="text-sm font-bold text-[#2E286C]/50">
                {detail.phone ?? '-'}
              </div>
            </ModulePanel>

            <ModulePanel>
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#2E286C]/50">
                {t('nextLesson')}
              </div>
              <div className="mb-1 text-lg font-bold text-[#2E286C]">
                {formatDateTime(detail.nextSessionAt, dateLocale)}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#533089]">
                <CalendarDays className="h-4 w-4" />
                {detail.branchName ?? detail.programName ?? '-'}
              </div>
            </ModulePanel>
          </div>

          <ModulePanel className="flex-1 p-5 lg:rounded-[2.5rem] lg:p-8">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-bold text-[#2E286C]">
                {t('courseHistory')}
              </h3>
              <Button variant="ghost" size="sm">
                {t('openCalendar')}
              </Button>
            </div>
            <div className="rounded-3xl border border-dashed border-[#533089]/20 bg-[#533089]/5 p-8 text-center">
              <p className="text-sm font-medium leading-relaxed text-[#2E286C]/55">
                {t('liveDataNote')}
              </p>
            </div>
          </ModulePanel>
        </div>
      </div>
    </div>
  );
}

function formatProgram(
  detail: NonNullable<Awaited<ReturnType<typeof getAdminStudentDetail>>>,
  domain: Awaited<ReturnType<typeof getTranslations>>,
) {
  const language = detail.language ? formatLanguage(detail.language, domain) : '-';
  return detail.programName ? `${language} • ${detail.programName}` : language;
}

function formatLanguage(
  language: string,
  domain: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (['arabic', 'english', 'french', 'german'].includes(language)) {
    return domain(`languages.${language}`);
  }
  return language;
}

function accountStateLabel(
  state: 'linked' | 'not_invited' | 'pending_invitation',
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (state === 'linked') return t('accountLinked');
  if (state === 'pending_invitation') return t('accountPending');
  return t('accountNotInvited');
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string | undefined, locale: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
