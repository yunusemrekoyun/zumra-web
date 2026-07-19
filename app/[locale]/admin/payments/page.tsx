import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  getAdminPaymentStats,
  listPayableEnrollments,
  listStaffPayments,
} from '@/lib/server/services/payments';
import { AdminPaymentsClient } from './_components/payments-client';

type PaymentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPaymentsPage({ params }: PaymentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const t = await getTranslations('admin.payments');
  const [stats, payments, enrollments] = await Promise.all([
    getAdminPaymentStats(principal),
    listStaffPayments(principal),
    listPayableEnrollments(principal),
  ]);

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />
      <AdminPaymentsClient
        enrollments={enrollments}
        payments={payments}
        stats={stats}
      />
    </div>
  );
}
