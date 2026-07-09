import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { PrivateLessonCreateForm } from '@/components/private-lesson-create-form';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listSchedulablePrivateEnrollments } from '@/lib/server/services/lesson-schedules';

type NewPrivateLessonPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewPrivateLessonPage({
  params,
}: NewPrivateLessonPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('privateLesson');
  const enrollments = await listSchedulablePrivateEnrollments(principal);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <PrivateLessonCreateForm
        locale={locale}
        enrollments={enrollments}
        showTeacher={false}
        returnTo={`/${locale}/ogretmen/takvim`}
      />
    </div>
  );
}
