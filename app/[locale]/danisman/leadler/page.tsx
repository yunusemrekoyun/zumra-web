import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listCandidateDirectory } from '@/lib/server/services/candidate-directory';
import { listAdvisors } from '@/lib/server/services/candidate-pipeline';
import { CandidatesClient } from '@/app/[locale]/admin/leads/_components/candidates-client';

type AdvisorLeadsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorLeadsPage({
  params,
}: AdvisorLeadsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [candidates, advisors] = await Promise.all([
    listCandidateDirectory(),
    listAdvisors(principal),
  ]);
  return (
    <CandidatesClient
      advisors={advisors}
      basePath="/danisman/leadler"
      candidates={candidates}
      currentUserId={principal.id}
    />
  );
}
