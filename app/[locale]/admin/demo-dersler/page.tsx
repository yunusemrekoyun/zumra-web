import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { DiscoveryClient } from '@/components/discovery/discovery-client';
import { buildDiscoveryLabels } from '@/components/discovery/discovery-labels';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  getDiscoverySchedulingOptions,
  listDiscoveryFees,
  listDiscoveryLessons,
} from '@/lib/server/services/discovery';

type AdminDiscoveryPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDiscoveryPage({
  params,
}: AdminDiscoveryPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [t, lessons, fees, options] = await Promise.all([
    getTranslations('discovery'),
    listDiscoveryLessons(principal),
    listDiscoveryFees(principal),
    getDiscoverySchedulingOptions(principal),
  ]);

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />
      <DiscoveryClient
        canManageFees
        fees={fees}
        labels={buildDiscoveryLabels(t)}
        lessons={lessons}
        locale={locale}
        options={options}
      />
    </div>
  );
}
