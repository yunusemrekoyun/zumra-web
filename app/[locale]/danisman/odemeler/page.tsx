import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  listPayableEnrollments,
  listStaffPayments,
} from '@/lib/server/services/payments';
import { AdvisorPaymentsClient } from './_components/advisor-payments-client';

type AdvisorPaymentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorPaymentsPage({
  params,
}: AdvisorPaymentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [t, payments, enrollments] = await Promise.all([
    getTranslations('advisor.payments'),
    listStaffPayments(principal),
    listPayableEnrollments(principal),
  ]);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <AdvisorPaymentsClient
        enrollments={enrollments}
        locale={locale}
        payments={payments}
      />
    </div>
  );
}
