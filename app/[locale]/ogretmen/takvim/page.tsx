import { getTranslations } from 'next-intl/server';
import { CalendarBoard, PageHeader, WorldClock } from '@/components/ui';
import { AddPrivateLessonButton } from '@/components/add-private-lesson-button';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listTeacherChangeRequests } from '@/lib/server/services/lesson-change-requests';
import { getTeacherCalendarData } from '@/lib/server/services/lesson-schedules';
import { getUserTimezone } from '@/lib/server/services/user-preferences';
import { ChangeRequestsPanel } from './change-requests-panel';

type TeacherCalendarPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function TeacherCalendarPage({
  params,
  searchParams,
}: TeacherCalendarPageProps) {
  const { locale } = await params;
  const { month } = await searchParams;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.calendar');
  const tp = await getTranslations('privateLesson');
  const [data, changeRequests, timezone] = await Promise.all([
    getTeacherCalendarData(principal),
    listTeacherChangeRequests(principal),
    getUserTimezone(principal.id),
  ]);
  const returnPath = `/${locale}/ogretmen/takvim${
    month ? `?month=${encodeURIComponent(month)}` : ''
  }`;
  const zoneCity =
    timezone.split('/').pop()?.replaceAll('_', ' ') ?? timezone;

  return (
    <div className="workspace-page">
      <PageHeader
        title={t('title')}
        description={
          data.instructor
            ? t('descriptionWithName', { name: data.instructor.fullName })
            : t('missingProfileDescription')
        }
        action={
          data.instructor ? (
            <AddPrivateLessonButton
              href="/ogretmen/ozel-ders/yeni"
              label={tp('addButton')}
            />
          ) : undefined
        }
      />
      <WorldClock title={t('worldClock')} viewerTimezone={timezone} />
      <ChangeRequestsPanel
        locale={locale}
        requests={changeRequests}
        timezone={timezone}
        labels={{
          approve: t('changeRequests.approve'),
          badge: t('changeRequests.badge'),
          empty: t('changeRequests.empty'),
          error: t('changeRequests.error'),
          errorConflict: t('changeRequests.errorConflict'),
          errorTimeRequired: t('changeRequests.errorTimeRequired'),
          newTimePlaceholder: t('changeRequests.newTimePlaceholder'),
          notePlaceholder: t('changeRequests.notePlaceholder'),
          reject: t('changeRequests.reject'),
          requestedTime: (time) => t('changeRequests.requestedTime', { time }),
          studentNote: (note) => t('changeRequests.studentNote', { note }),
          title: t('changeRequests.title'),
          typeCancel: t('changeRequests.typeCancel'),
          typePostpone: t('changeRequests.typePostpone'),
        }}
      />
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
          emptyDescription: data.instructor
            ? t('emptyDescription')
            : t('missingProfileDescription'),
          emptyTitle: data.instructor ? t('emptyTitle') : t('missingProfileTitle'),
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
          takeAttendance: t('takeAttendance'),
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
