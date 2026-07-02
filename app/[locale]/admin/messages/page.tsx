import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';
import { AdminMessagesClient } from './admin-messages-client';

function MessagesPage() {
  const t = useTranslations('admin.messages');

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />
      <AdminMessagesClient />
    </div>
  );
}

export default withWorkspacePage('admin', MessagesPage);
