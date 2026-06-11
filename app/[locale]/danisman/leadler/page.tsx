import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function AdvisorLeadsPage() {
  const t = useTranslations('advisor.empty.leads');
  const common = useTranslations('common.actions');

  return (
    <div className="workspace-page">
      <EmptyState
        icon={Users}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}

export default withWorkspacePage('advisor', AdvisorLeadsPage);
