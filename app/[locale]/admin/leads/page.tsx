import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listCandidateDirectory } from '@/lib/server/services/candidate-directory';
import { listAdvisors } from '@/lib/server/services/candidate-pipeline';
import { CandidatesClient } from './_components/candidates-client';

type CandidatesPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CandidatesPage({ params }: CandidatesPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [candidates, advisors] = await Promise.all([
    listCandidateDirectory(),
    listAdvisors(principal),
  ]);
  return <CandidatesClient advisors={advisors} candidates={candidates} />;
}
