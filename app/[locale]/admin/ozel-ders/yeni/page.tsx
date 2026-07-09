import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { PrivateLessonCreateForm } from '@/components/private-lesson-create-form';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listSchedulablePrivateEnrollments } from '@/lib/server/services/lesson-schedules';

type NewAdminPrivateLessonPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewAdminPrivateLessonPage({
  params,
}: NewAdminPrivateLessonPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const t = await getTranslations('privateLesson');
  const enrollments = await listSchedulablePrivateEnrollments(principal);

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />
      <PrivateLessonCreateForm
        locale={locale}
        enrollments={enrollments}
        showTeacher
        returnTo={`/${locale}/admin/calendar`}
      />
    </div>
  );
}
