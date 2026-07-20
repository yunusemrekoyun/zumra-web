import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { DiscoveryClient } from '@/components/discovery/discovery-client';
import { buildDiscoveryLabels } from '@/components/discovery/discovery-labels';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  getDiscoverySchedulingOptions,
  listDiscoveryLessons,
} from '@/lib/server/services/discovery';

type AdvisorDiscoveryPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorDiscoveryPage({
  params,
}: AdvisorDiscoveryPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [t, lessons, options] = await Promise.all([
    getTranslations('discovery'),
    listDiscoveryLessons(principal),
    getDiscoverySchedulingOptions(principal),
  ]);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <DiscoveryClient
        canManageFees={false}
        fees={[]}
        labels={buildDiscoveryLabels(t)}
        lessons={lessons}
        locale={locale}
        options={options}
      />
    </div>
  );
}
