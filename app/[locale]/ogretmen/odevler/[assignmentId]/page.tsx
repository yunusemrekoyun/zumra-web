import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAssignmentForGrading } from '@/lib/server/services/assignments';
import { GradingClient } from './grading-client';

type GradeAssignmentPageProps = {
  params: Promise<{ assignmentId: string; locale: string }>;
};

export default async function GradeAssignmentPage({
  params,
}: GradeAssignmentPageProps) {
  const { assignmentId, locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.assignments');

  let data: Awaited<ReturnType<typeof getAssignmentForGrading>>;
  try {
    data = await getAssignmentForGrading(principal, assignmentId);
  } catch {
    notFound();
  }

  return (
    <div className="workspace-page">
      <PageHeader
        title={data.assignment.title}
        description={t('grading.description', {
          target: data.assignment.targetLabel,
        })}
      />
      <GradingClient data={data} locale={locale} />
    </div>
  );
}
