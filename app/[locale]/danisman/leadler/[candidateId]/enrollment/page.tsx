import { notFound } from 'next/navigation';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getEnrollmentDraftForAdmin } from '@/lib/server/services/enrollments';
import { getEnrollmentProgramCatalog } from '@/lib/server/services/programs';
import { EnrollmentWizard } from '@/app/[locale]/admin/leads/[candidateId]/enrollment/enrollment-wizard';

type AdvisorEnrollmentPageProps = {
  params: Promise<{ candidateId: string; locale: string }>;
};

export default async function AdvisorEnrollmentPage({
  params,
}: AdvisorEnrollmentPageProps) {
  const { candidateId, locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [enrollment, catalog] = await Promise.all([
    getEnrollmentDraftForAdmin(principal, candidateId),
    getEnrollmentProgramCatalog(principal),
  ]);

  if (!enrollment) {
    notFound();
  }

  return (
    <EnrollmentWizard
      catalog={catalog}
      initial={enrollment}
      returnPath="/danisman/leadler"
    />
  );
}
