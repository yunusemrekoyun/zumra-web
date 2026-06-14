import { notFound } from 'next/navigation';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getEnrollmentDraftForAdmin } from '@/lib/server/services/enrollments';
import { getEnrollmentProgramCatalog } from '@/lib/server/services/programs';
import { EnrollmentWizard } from './enrollment-wizard';

type EnrollmentPageProps = {
  params: Promise<{ candidateId: string; locale: string }>;
};

export default async function EnrollmentPage({
  params,
}: EnrollmentPageProps) {
  const { candidateId, locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [enrollment, catalog] = await Promise.all([
    getEnrollmentDraftForAdmin(principal, candidateId),
    getEnrollmentProgramCatalog(principal),
  ]);

  if (!enrollment) {
    notFound();
  }

  return <EnrollmentWizard catalog={catalog} initial={enrollment} />;
}
