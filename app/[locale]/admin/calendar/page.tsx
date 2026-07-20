import { getTranslations } from 'next-intl/server';
import { CalendarBoard, PageHeader, WorldClock } from '@/components/ui';
import { AddPrivateLessonButton } from '@/components/add-private-lesson-button';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAdminCalendarData } from '@/lib/server/services/lesson-schedules';
import { getUserTimezone } from '@/lib/server/services/user-preferences';

type AdminCalendarPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function AdminCalendarPage({
  params,
  searchParams,
}: AdminCalendarPageProps) {
  const { locale } = await params;
  const { month } = await searchParams;
  const principal = await requireWorkspaceRole('admin', locale);
  const t = await getTranslations('admin.calendar');
  const tp = await getTranslations('privateLesson');
  const [data, timezone] = await Promise.all([
    getAdminCalendarData(principal),
    getUserTimezone(principal.id),
  ]);
  const returnPath = `/${locale}/admin/calendar${
    month ? `?month=${encodeURIComponent(month)}` : ''
  }`;
  const zoneCity =
    timezone.split('/').pop()?.replaceAll('_', ' ') ?? timezone;

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <AddPrivateLessonButton
            href="/admin/ozel-ders/yeni"
            label={tp('addButton')}
          />
        }
      />
      <WorldClock title={t('worldClock')} viewerTimezone={timezone} />
      <CalendarBoard
        currentMonth={month}
        events={data.events}
        locale={locale}
        returnPath={returnPath}
        timezone={timezone}
        labels={{
          absenceNotePlaceholder: t('absenceNotePlaceholder'),
          absenceReported: t('absenceReported'),
          agendaTitle: t('agendaTitle'),
          connectGoogle: t('connectGoogle'),
          detailView: t('detailView'),
          emptyDescription: t('emptyDescription'),
          emptyTitle: t('emptyTitle'),
          eventKinds: {
            appointment: t('eventKinds.appointment'),
            group_lesson: t('eventKinds.group_lesson'),
            private_lesson: t('eventKinds.private_lesson'),
          },
          hoverHint: t('hoverHint'),
          joinLesson: t('joinLesson'),
          legendTitle: t('legendTitle'),
          meetingAttempts: (count) => t('meetingAttempts', { count }),
          meetingLastError: t('meetingLastError'),
          meetingStatuses: {
            creating: t('meetingStatuses.creating'),
            disabled: t('meetingStatuses.disabled'),
            failed: t('meetingStatuses.failed'),
            pending: t('meetingStatuses.pending'),
            ready: t('meetingStatuses.ready'),
          },
          monthView: t('monthView'),
          moreEvents: (count) => t('moreEvents', { count }),
          nextMonth: t('nextMonth'),
          noEventsInMonth: t('noEventsInMonth'),
          previousMonth: t('previousMonth'),
          reportAbsence: t('reportAbsence'),
          retryMeeting: t('retryMeeting'),
          status: {
            cancelled: t('statuses.cancelled'),
            completed: t('statuses.completed'),
            postponed: t('statuses.postponed'),
            scheduled: t('statuses.scheduled'),
          },
          studentCount: (count) => t('studentCount', { count }),
          joinOpensAt: (time) => t('joinOpensAt', { time }),
          endLesson: t('endLesson'),
          endLessonConfirm: t('endLessonConfirm'),
          endLessonError: t('endLessonError'),
          lessonStatus: {
            cancel: t('lessonStatus.cancel'),
            cancelSubmit: t('lessonStatus.cancelSubmit'),
            postpone: t('lessonStatus.postpone'),
            postponeSubmit: t('lessonStatus.postponeSubmit'),
            newTimePlaceholder: t('lessonStatus.newTimePlaceholder'),
            notePlaceholder: t('lessonStatus.notePlaceholder'),
            dismiss: t('lessonStatus.dismiss'),
            error: t('lessonStatus.error'),
          },
          upcomingTitle: t('upcomingTitle'),
          upcomingEmpty: t('upcomingEmpty'),
          pastTitle: t('pastTitle'),
          todayLabel: t('today'),
          tomorrowLabel: t('tomorrow'),
          timezoneNote:
            timezone === APP_TIME_ZONE
              ? undefined
              : t('timezoneNote', { zone: zoneCity }),
        }}
      />
    </div>
  );
}
