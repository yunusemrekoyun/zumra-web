import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState, Button } from '@/components/ui';

export default function MessagesPage() {
  const t = useTranslations('admin.empty.messages');
  const common = useTranslations('common.actions');

  return (
    <div className="admin-page">
      <EmptyState
        icon={MessageSquare}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}
