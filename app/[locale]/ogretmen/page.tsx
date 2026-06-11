import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WorkspaceEmptyDashboard } from '@/components/ui';
import { getDashboardData } from '@/lib/domain';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function TeacherDashboardPage() {
  const t = useTranslations('teacher.dashboard');
  const dashboard = getDashboardData('teacher');
  const lessonRecords = dashboard.lessons;
  const students = dashboard.students;
  const upcomingLessons = lessonRecords.filter((lesson) => lesson.status === 'upcoming');
  const completedLessons = lessonRecords.filter((lesson) => lesson.status === 'completed');

  return (
    <WorkspaceEmptyDashboard
      icon={BookOpen}
      title={t('title')}
      description={t('description')}
      moduleTitle={t('moduleTitle')}
      metrics={[
        { label: t('students'), value: students.length },
        { label: t('upcomingLessons'), value: upcomingLessons.length },
        { label: t('completedLessons'), value: completedLessons.length },
        { label: t('activeProgram'), value: '1' },
      ]}
    />
  );
}

export default withWorkspacePage('teacher', TeacherDashboardPage);
