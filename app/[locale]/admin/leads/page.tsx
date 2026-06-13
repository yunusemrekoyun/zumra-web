import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listCandidateDirectory } from '@/lib/server/services/candidate-directory';
import { CandidatesClient } from './_components/candidates-client';

type CandidatesPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CandidatesPage({ params }: CandidatesPageProps) {
  const { locale } = await params;
  await requireWorkspaceRole('admin', locale);
  const candidates = await listCandidateDirectory();
  return <CandidatesClient candidates={candidates} />;
}
