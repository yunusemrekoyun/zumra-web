import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getInstructorDirectory } from '@/lib/server/services/instructors';
import { InstructorsClient } from './instructors-client';

type InstructorsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function InstructorsPage({
  params,
}: InstructorsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const instructors = await getInstructorDirectory(principal);

  return <InstructorsClient initial={instructors} />;
}
