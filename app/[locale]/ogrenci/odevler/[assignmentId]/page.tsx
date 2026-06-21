import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getStudentAssignment } from '@/lib/server/services/assignments';
import { SubmissionClient } from './submission-client';

type StudentAssignmentPageProps = {
  params: Promise<{ assignmentId: string; locale: string }>;
};

export default async function StudentAssignmentPage({
  params,
}: StudentAssignmentPageProps) {
  const { assignmentId, locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const t = await getTranslations('student.assignments');

  let data: Awaited<ReturnType<typeof getStudentAssignment>>;
  try {
    data = await getStudentAssignment(principal, assignmentId);
  } catch {
    notFound();
  }

  return (
    <div className="workspace-page">
      <PageHeader
        title={data.title}
        description={t('detail.from', { name: data.instructorName })}
      />
      <SubmissionClient data={data} locale={locale} />
    </div>
  );
}
