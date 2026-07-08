import { getTranslations } from 'next-intl/server';
import { CalendarBoard, PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAdminCalendarData } from '@/lib/server/services/lesson-schedules';

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
  const data = await getAdminCalendarData(principal);
  const returnPath = `/${locale}/admin/calendar${
    month ? `?month=${encodeURIComponent(month)}` : ''
  }`;

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />
      <CalendarBoard
        currentMonth={month}
        events={data.events}
        locale={locale}
        returnPath={returnPath}
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
        }}
      />
    </div>
  );
}
