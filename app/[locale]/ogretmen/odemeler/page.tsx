import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getTeacherPaymentWorkspace } from '@/lib/server/services/payments';
import { TeacherPaymentsClient } from './_components/teacher-payments-client';

type TeacherPaymentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TeacherPaymentsPage({
  params,
}: TeacherPaymentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.payments');
  const data = await getTeacherPaymentWorkspace(principal);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <TeacherPaymentsClient data={data} locale={locale} />
    </div>
  );
}
