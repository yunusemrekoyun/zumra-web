import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getProgramManagementData } from '@/lib/server/services/programs';
import { ProgramsClient } from './programs-client';

type ProgramsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ProgramsPage({ params }: ProgramsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const data = await getProgramManagementData(principal);

  return <ProgramsClient initial={data} />;
}
