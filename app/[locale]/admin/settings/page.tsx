import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState, Button } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function SettingsPage() {
  const t = useTranslations('admin.empty.settings');
  const common = useTranslations('common.actions');

  return (
    <div className="admin-page">
      <EmptyState
        icon={Settings}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}

export default withWorkspacePage('admin', SettingsPage);
