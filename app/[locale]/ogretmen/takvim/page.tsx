import { getTranslations } from 'next-intl/server';
import { CalendarBoard, PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getTeacherCalendarData } from '@/lib/server/services/lesson-schedules';

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
  const data = await getTeacherCalendarData(principal);
  const returnPath = `/${locale}/ogretmen/takvim${
    month ? `?month=${encodeURIComponent(month)}` : ''
  }`;

  return (
    <div className="workspace-page">
      <PageHeader
        title={t('title')}
        description={
          data.instructor
            ? t('descriptionWithName', { name: data.instructor.fullName })
            : t('missingProfileDescription')
        }
      />
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
        }}
      />
    </div>
  );
}
