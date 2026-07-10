import { notFound } from 'next/navigation';
import { StudentDetailView } from '@/components/student-detail-view';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAdvisors } from '@/lib/server/services/candidate-pipeline';
import {
  getPersonJourney,
  getStudentJourneyContext,
} from '@/lib/server/services/person-journey';
import {
  getAdminStudentActivity,
  getAdminStudentDetail,
} from '@/lib/server/services/students';

type StudentDetailPageProps = {
  params: Promise<{ locale: string; studentId: string }>;
};

export default async function StudentDetailPage({
  params,
}: StudentDetailPageProps) {
  const { locale, studentId } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [detail, activity, journeyContext, advisors] = await Promise.all([
    getAdminStudentDetail(principal, studentId),
    getAdminStudentActivity(principal, studentId),
    getStudentJourneyContext(principal, studentId),
    listAdvisors(principal),
  ]);

  if (!detail) {
    notFound();
  }

  const journey = journeyContext
    ? await getPersonJourney(principal, journeyContext.candidateId)
    : null;

  return (
    <StudentDetailView
      activity={activity}
      advisors={advisors}
      backHref="/admin/students"
      calendarHref="/admin/calendar"
      detail={detail}
      journey={journey}
      locale={locale}
      messagesHref={`/admin/messages?q=${encodeURIComponent(detail.fullName)}`}
    />
  );
}
