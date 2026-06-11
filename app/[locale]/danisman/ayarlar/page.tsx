import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function AdvisorSettingsPage() {
  const t = useTranslations('advisor.empty.settings');
  const common = useTranslations('common.actions');

  return (
    <div className="workspace-page">
      <EmptyState
        icon={Settings}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}

export default withWorkspacePage('advisor', AdvisorSettingsPage);
