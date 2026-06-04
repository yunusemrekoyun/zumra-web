import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';

export default function AdvisorOffersPage() {
  const t = useTranslations('advisor.empty.offers');
  const common = useTranslations('common.actions');

  return (
    <div className="workspace-page">
      <EmptyState
        icon={Target}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}
