import { getTranslations } from 'next-intl/server';
import { CalendarBoard, PageHeader, WorldClock } from '@/components/ui';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getStudentCalendarData } from '@/lib/server/services/lesson-schedules';
import { getUserTimezone } from '@/lib/server/services/user-preferences';

type StudentCalendarPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function StudentCalendarPage({
  params,
  searchParams,
}: StudentCalendarPageProps) {
  const { locale } = await params;
  const { month } = await searchParams;
  const principal = await requireWorkspaceRole('student', locale);
  const t = await getTranslations('student.calendar');
  const [data, timezone] = await Promise.all([
    getStudentCalendarData(principal),
    getUserTimezone(principal.id),
  ]);
  const returnPath = `/${locale}/ogrenci/takvim${
    month ? `?month=${encodeURIComponent(month)}` : ''
  }`;
  const zoneCity =
    timezone.split('/').pop()?.replaceAll('_', ' ') ?? timezone;

  return (
    <div className="workspace-page">
      <PageHeader
        title={t('title')}
        description={
          data.student
            ? t('descriptionWithName', { name: data.student.fullName })
            : t('missingProfileDescription')
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
          emptyDescription: data.student
            ? t('emptyDescription')
            : t('missingProfileDescription'),
          emptyTitle: data.student ? t('emptyTitle') : t('missingProfileTitle'),
          eventKinds: {
            appointment: t('eventKinds.appointment'),
            group_lesson: t('eventKinds.group_lesson'),
            private_lesson: t('eventKinds.private_lesson'),
          },
          hoverHint: t('hoverHint'),
          joinLesson: t('joinLesson'),
          legendTitle: t('legendTitle'),
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
          changeRequest: {
            dismiss: t('changeRequest.dismiss'),
            error: t('changeRequest.error'),
            errorCutoff: t('changeRequest.errorCutoff'),
            errorPending: t('changeRequest.errorPending'),
            newTimePlaceholder: t('changeRequest.newTimePlaceholder'),
            notePlaceholder: t('changeRequest.notePlaceholder'),
            requestCancel: t('changeRequest.requestCancel'),
            requestPostpone: t('changeRequest.requestPostpone'),
            submit: t('changeRequest.submit'),
          },
          changeRequestPending: t('changeRequest.pending'),
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
