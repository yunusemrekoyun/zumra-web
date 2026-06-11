import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function TeacherCalendarPage() {
  const t = useTranslations('teacher.empty.calendar');
  const common = useTranslations('common.actions');

  return (
    <div className="workspace-page">
      <EmptyState
        icon={Calendar}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}

export default withWorkspacePage('teacher', TeacherCalendarPage);
