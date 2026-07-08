import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAdminLegalPages } from '@/lib/server/services/legal-pages';
import { LegalClient } from './legal-client';

type AdminLegalPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminLegalPage({ params }: AdminLegalPageProps) {
  const { locale } = await params;
  await requireWorkspaceRole('admin', locale);
  const t = await getTranslations('admin.legal');
  const pages = await listAdminLegalPages();

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />
      <LegalClient initialPages={pages} locale={locale} />
    </div>
  );
}
