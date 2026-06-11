import { Presentation } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState, Button } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function InstructorsPage() {
  const t = useTranslations('admin.empty.instructors');
  const common = useTranslations('common.actions');

  return (
    <div className="admin-page">
      <EmptyState
        icon={Presentation}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}

export default withWorkspacePage('admin', InstructorsPage);
