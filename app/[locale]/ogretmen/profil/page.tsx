import { UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function TeacherProfilePage() {
  const t = useTranslations('teacher.empty.profile');
  const common = useTranslations('common.actions');

  return (
    <div className="workspace-page">
      <EmptyState
        icon={UserCheck}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}

export default withWorkspacePage('teacher', TeacherProfilePage);
