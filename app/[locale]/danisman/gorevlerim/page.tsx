import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAdvisorTasks } from '@/lib/server/services/advisor-tasks';
import { TasksClient } from './tasks-client';

type AdvisorTasksPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorTasksPage({
  params,
}: AdvisorTasksPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [t, board] = await Promise.all([
    getTranslations('advisor.tasks'),
    listAdvisorTasks(principal),
  ]);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <TasksClient board={board} locale={locale} />
    </div>
  );
}
