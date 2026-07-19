import { getTranslations } from 'next-intl/server';
import { Wallet } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getStudentPaymentOverview } from '@/lib/server/services/payments';
import {
  StudentPaymentsClient,
  type StudentPaymentEnrollment,
} from './_components/student-payments-client';

type StudentPaymentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StudentPaymentsPage({
  params,
}: StudentPaymentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const [t, status] = await Promise.all([
    getTranslations('student.payments'),
    getTranslations('common.status'),
  ]);
  const overview = await getStudentPaymentOverview(principal);

  // 'completed' enrollments render with the shared 'graduated' status label.
  const enrollments: StudentPaymentEnrollment[] = overview.enrollments.map(
    (enrollment) => ({
      ...enrollment,
      statusLabel: status(
        enrollment.status === 'completed' ? 'graduated' : enrollment.status,
      ),
    }),
  );

  if (enrollments.length === 0) {
    return (
      <div className="admin-page">
        <PageHeader title={t('title')} />
        <EmptyState
          description={t('description')}
          icon={Wallet}
          title={t('empty')}
        />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />
      <StudentPaymentsClient enrollments={enrollments} locale={locale} />
    </div>
  );
}
