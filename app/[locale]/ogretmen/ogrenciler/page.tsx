import { GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@/components/ui';

export default function TeacherStudentsPage() {
  const t = useTranslations('teacher.empty.students');
  const common = useTranslations('common.actions');

  return (
    <div className="workspace-page">
      <EmptyState
        icon={GraduationCap}
        title={t('title')}
        description={t('description')}
        action={<Button variant="secondary" disabled>{common('soon')}</Button>}
      />
    </div>
  );
}
