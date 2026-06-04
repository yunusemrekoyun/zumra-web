import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WorkspaceEmptyDashboard } from '@/components/ui';
import { getDashboardData } from '@/lib/domain';

export default function AdvisorDashboardPage() {
  const t = useTranslations('advisor.dashboard');
  const dashboard = getDashboardData('advisor');

  return (
    <WorkspaceEmptyDashboard
      icon={Calendar}
      title={t('title')}
      description={t('description')}
      moduleTitle={t('moduleTitle')}
      metrics={[
        { label: t('leads'), value: dashboard.leads.length },
        { label: t('students'), value: dashboard.students.length },
        { label: t('meetings'), value: dashboard.meetings.length },
        { label: t('offers'), value: dashboard.offers.length },
      ]}
    />
  );
}
