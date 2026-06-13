import { notFound } from 'next/navigation';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getEnrollmentDraftForAdmin } from '@/lib/server/services/enrollments';
import { EnrollmentWizard } from './enrollment-wizard';

type EnrollmentPageProps = {
  params: Promise<{ candidateId: string; locale: string }>;
};

export default async function EnrollmentPage({
  params,
}: EnrollmentPageProps) {
  const { candidateId, locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const enrollment = await getEnrollmentDraftForAdmin(principal, candidateId);

  if (!enrollment) {
    notFound();
  }

  return <EnrollmentWizard initial={enrollment} />;
}
