import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listCandidateDirectory } from '@/lib/server/services/candidate-directory';
import { listAdvisors } from '@/lib/server/services/candidate-pipeline';
import { CandidatesClient } from './_components/candidates-client';

type CandidatesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ candidate?: string }>;
};

export default async function CandidatesPage({
  params,
  searchParams,
}: CandidatesPageProps) {
  const { locale } = await params;
  const { candidate } = await searchParams;
  const principal = await requireWorkspaceRole('admin', locale);
  const [candidates, advisors] = await Promise.all([
    listCandidateDirectory(),
    listAdvisors(principal),
  ]);
  return (
    <CandidatesClient
      // Remount when the deep-link target changes so the selection applies
      // even when the global search navigates within this page.
      key={candidate ?? 'directory'}
      advisors={advisors}
      candidates={candidates}
      currentUserId={principal.id}
      initialSelectedId={candidate}
    />
  );
}
