import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Mail,
  MessageSquare,
  UserRoundCheck,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  ActionBar,
  Card,
  InfoField,
  ModulePanel,
  StatusChip,
} from '@/components/ui';
import { PersonJourneyPanel } from '@/components/person-journey-panel';
import { ProfilePhotoUploader } from '@/components/profile-photo-uploader';
import type { AdvisorOption } from '@/lib/server/services/candidate-pipeline';
import type { PersonJourney } from '@/lib/server/services/person-journey';
import type {
  getAdminStudentActivity,
  getAdminStudentDetail,
} from '@/lib/server/services/students';

type Detail = NonNullable<Awaited<ReturnType<typeof getAdminStudentDetail>>>;
type Activity = Awaited<ReturnType<typeof getAdminStudentActivity>>;

/**
 * The full student profile — identity card, account/contact/next-lesson tiles,
 * course history and the staff-only journey panel. Shared verbatim between the
 * admin detail page and the advisor's student profile; role differences are
 * only the wrapper links (back / messages / calendar).
 */
export async function StudentDetailView({
  activity,
  advisors,
  backHref,
  calendarHref,
  detail,
  journey,
  locale,
  messagesHref,
  photoManageEndpoint,
  photoUrl,
}: {
  activity: Activity;
  advisors: AdvisorOption[];
  backHref: string;
  calendarHref?: string;
  detail: Detail;
  journey: PersonJourney | null;
  locale: string;
  messagesHref?: string;
  photoManageEndpoint?: string;
  photoUrl?: string | null;
}) {
  const [t, studentsT, status, attendance, domain] = await Promise.all([
    getTranslations('admin.studentDetail'),
    getTranslations('admin.students'),
    getTranslations('common.status'),
    getTranslations('common.attendance'),
    getTranslations('domain'),
  ]);

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
            href={backHref}
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
          <a
            href={`mailto:${detail.email}`}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-[#2E286C] transition-all hover:bg-black/[0.03]"
          >
            <Mail className="h-4 w-4" /> {t('email')}
          </a>
          {messagesHref && (
            <Link
              href={messagesHref}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-2xl bg-[#533089] px-3 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-[#533089]/20 transition-all hover:scale-105 hover:bg-[#462878]"
            >
              <MessageSquare className="h-4 w-4" /> {t('sendMessage')}
            </Link>
          )}
        </ActionBar>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
          <ModulePanel className="flex flex-col items-center text-center">
            <div className="mx-auto mb-4">
              {photoManageEndpoint ? (
                <ProfilePhotoUploader
                  endpoint={photoManageEndpoint}
                  name={detail.fullName}
                  photoUrl={photoUrl ?? null}
                />
              ) : (
                <ProfilePhotoUploader
                  editable={false}
                  name={detail.fullName}
                  photoUrl={photoUrl ?? null}
                />
              )}
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
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-bold text-[#2E286C]">
                {t('courseHistory')}
              </h3>
              {calendarHref && (
                <Link
                  href={calendarHref}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-2xl px-3 text-[11px] font-bold uppercase tracking-wider text-[#2E286C]/60 transition-all hover:bg-black/[0.03] hover:text-[#2E286C]"
                >
                  {t('openCalendar')}
                </Link>
              )}
            </div>

            {activity.lessons.length === 0 &&
            activity.submissions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#533089]/20 bg-[#533089]/5 p-8 text-center">
                <p className="text-sm font-medium leading-relaxed text-[#2E286C]/55">
                  {t('noActivity')}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2E286C]/50">
                    {t('recentLessons')}
                  </div>
                  {activity.lessons.length ? (
                    <div className="space-y-2">
                      {activity.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-3 rounded-2xl bg-[#F8F9FC] p-3"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#533089] shadow-sm">
                            <CalendarDays className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-[#2E286C]">
                              {lesson.label ?? t('privateLesson')}
                            </div>
                            <div className="text-xs font-medium text-[#2E286C]/45">
                              {formatDateTime(lesson.startsAt, dateLocale)}
                            </div>
                          </div>
                          <StatusChip
                            tone={attendanceTone(lesson.status)}
                            className="shrink-0"
                          >
                            {attendanceLabel(lesson.status, attendance)}
                          </StatusChip>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-[#2E286C]/45">
                      {t('noLessons')}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[#2E286C]/50">
                    {t('recentSubmissions')}
                  </div>
                  {activity.submissions.length ? (
                    <div className="space-y-2">
                      {activity.submissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="flex items-center gap-3 rounded-2xl bg-[#F8F9FC] p-3"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#533089] shadow-sm">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-[#2E286C]">
                              {submission.title}
                            </div>
                            <div className="text-xs font-medium text-[#2E286C]/45">
                              {formatDateTime(submission.submittedAt, dateLocale)}
                            </div>
                          </div>
                          <StatusChip
                            tone={submission.graded ? 'emerald' : 'amber'}
                            className="shrink-0"
                          >
                            {submission.graded
                              ? `${submission.score}/${submission.maxScore}`
                              : t('awaitingGrade')}
                          </StatusChip>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-[#2E286C]/45">
                      {t('noSubmissions')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </ModulePanel>
        </div>
      </div>

      {journey && (
        <PersonJourneyPanel
          advisors={advisors}
          journey={journey}
          locale={locale}
        />
      )}
    </div>
  );
}

function formatProgram(
  detail: Detail,
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

function attendanceTone(status: string) {
  if (status === 'present') return 'emerald' as const;
  if (status === 'late') return 'amber' as const;
  if (status === 'absent') return 'red' as const;
  return 'gray' as const;
}

function attendanceLabel(
  status: string,
  attendance: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (['present', 'late', 'absent', 'excused'].includes(status)) {
    return attendance(status);
  }
  return '—';
}

