import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowRight, BookOpen, Video } from 'lucide-react';
import {
  Avatar,
  Card,
  EmptyState,
  LessonCard,
  SectionHeader,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  type CalendarEventView,
  getStudentWorkspaceData,
} from '@/lib/server/services/student-workspace';
import { formatEventDateTime, lessonCardProps, lessonTitle } from './lesson-display';

type StudentDashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StudentDashboardPage({
  params,
}: StudentDashboardPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const data = await getStudentWorkspaceData(principal);
  const [t, common, calendar] = await Promise.all([
    getTranslations('student.dashboard'),
    getTranslations('common.actions'),
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

  const firstName = data.student.fullName.split(' ')[0] || data.student.fullName;
  const level = data.student.currentLevel ?? data.enrollment?.currentLevel;
  const programLabel =
    data.enrollment?.programName ?? data.enrollment?.language;
  const subtitle = [level, programLabel].filter(Boolean).join(' • ');
  const next = data.lessons.next;

  return (
    <StaggerContainer className="admin-page">
      {/* Welcome card */}
      <StaggerItem>
        <Card variant="gradient" className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <Avatar
                name={data.student.fullName}
                size="lg"
                variant="brand"
                className="border-4 border-white/20"
              />
              <div>
                <h1 className="text-xl lg:text-2xl font-rosmatika font-medium text-white">
                  {t('hello', { name: firstName })}
                </h1>
                {subtitle && (
                  <p className="text-white/70 text-sm font-medium mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <span className="text-white/60 text-xs font-medium">
              {t('encouragement')}
            </span>
          </div>
          <BookOpen className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5" />
        </Card>
      </StaggerItem>

      {/* Next lesson highlight */}
      <StaggerItem>
        <Card padded className="border-l-4 border-l-[#533089]">
          <SectionHeader title={t('nextLesson')} />
          {next ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-[#2E286C] text-lg">
                  {lessonTitle(next)}
                </h3>
                <p className="text-sm text-[#2E286C]/50 font-medium mt-1">
                  {[next.instructorName, formatEventDateTime(next, locale)]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>
              <NextLessonAction
                connectGoogleLabel={calendar('connectGoogle')}
                event={next}
                joinLabel={common('joinLesson')}
                locale={locale}
                preparingLabel={calendar(
                  `meetingStatuses.${next.meetingStatus ?? 'pending'}`,
                )}
              />
            </div>
          ) : (
            <p className="text-sm text-[#2E286C]/50 font-medium">
              {t('noUpcomingLesson')}
            </p>
          )}
        </Card>
      </StaggerItem>

      {/* Upcoming lessons */}
      {data.lessons.upcoming.length > 0 && (
        <StaggerItem>
          <SectionHeader title={t('upcomingLessons')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.lessons.upcoming.map((event) => (
              <LessonCard key={event.id} {...lessonCardProps(event, locale, 'upcoming')} />
            ))}
          </div>
        </StaggerItem>
      )}

      {/* Completed lessons */}
      {data.lessons.past.length > 0 && (
        <StaggerItem>
          <SectionHeader title={t('completedLessons')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.lessons.past.slice(0, 6).map((event) => (
              <LessonCard key={event.id} {...lessonCardProps(event, locale, 'completed')} />
            ))}
          </div>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

function NextLessonAction({
  connectGoogleLabel,
  event,
  joinLabel,
  locale,
  preparingLabel,
}: {
  connectGoogleLabel: string;
  event: CalendarEventView;
  joinLabel: string;
  locale: string;
  preparingLabel: string;
}) {
  if (event.meetingStatus === 'ready' && event.joinUrl && !event.requiresGoogleLink) {
    return (
      <Link
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#533089] px-4 py-3 text-xs font-bold text-white shadow-sm transition-[background,transform] duration-150 hover:bg-[#43236f] active:scale-[0.99]"
        href={event.joinUrl}
        rel="noreferrer"
        target="_blank"
      >
        <Video className="h-4 w-4" />
        {joinLabel}
      </Link>
    );
  }

  if (event.requiresGoogleLink) {
    return (
      <Link
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 py-3 text-xs font-bold text-[#533089] transition-colors duration-150 hover:bg-[#533089]/7"
        href={`/${locale}/ogrenci/profil?google=required`}
      >
        <Video className="h-4 w-4" />
        {connectGoogleLabel}
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 py-3 text-xs font-bold text-[#2E286C]/50">
      <ArrowRight className="h-4 w-4" />
      {preparingLabel}
    </span>
  );
}
