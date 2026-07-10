import { notFound } from 'next/navigation';
import { StudentDetailView } from '@/components/student-detail-view';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAdvisors } from '@/lib/server/services/candidate-pipeline';
import {
  getPersonJourney,
  getStudentJourneyContext,
} from '@/lib/server/services/person-journey';
import { getProfilePhotoUrl } from '@/lib/server/services/profile-photo';
import {
  getAdminStudentActivity,
  getAdminStudentDetail,
} from '@/lib/server/services/students';

type AdvisorStudentDetailPageProps = {
  params: Promise<{ locale: string; studentId: string }>;
};

export default async function AdvisorStudentDetailPage({
  params,
}: AdvisorStudentDetailPageProps) {
  const { locale, studentId } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
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
  const photoUrl = journeyContext?.userId
    ? await getProfilePhotoUrl(journeyContext.userId)
    : null;

  return (
    <StudentDetailView
      activity={activity}
      advisors={advisors}
      backHref="/danisman/ogrenciler"
      detail={detail}
      journey={journey}
      locale={locale}
      photoUrl={photoUrl}
    />
  );
}
