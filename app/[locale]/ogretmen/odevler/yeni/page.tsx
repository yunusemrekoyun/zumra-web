import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAssignableLessonsForInstructor } from '@/lib/server/services/assignments';
import { getTeacherWorkspaceData } from '@/lib/server/services/teacher-workspace';
import { AssignmentCreateClient } from './assignment-create-client';

type NewAssignmentPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewAssignmentPage({
  params,
}: NewAssignmentPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.assignments');
  const [data, lessons] = await Promise.all([
    getTeacherWorkspaceData(principal),
    listAssignableLessonsForInstructor(principal),
  ]);

  return (
    <div className="workspace-page">
      <PageHeader title={t('create.title')} description={t('create.description')} />
      <AssignmentCreateClient
        locale={locale}
        branches={data.branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
        }))}
        students={data.students.map((student) => ({
          enrollmentId: student.enrollmentId,
          name: student.fullName,
          branchName: student.branchName,
        }))}
        lessons={lessons}
      />
    </div>
  );
}
