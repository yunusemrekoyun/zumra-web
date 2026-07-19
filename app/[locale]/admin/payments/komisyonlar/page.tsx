import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getCommissionCatalog } from '@/lib/server/services/payments';
import { CommissionsClient } from './_components/commissions-client';

type CommissionsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CommissionsPage({
  params,
}: CommissionsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const t = await getTranslations('admin.commissions');
  const catalog = await getCommissionCatalog(principal);

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Link
            href="/admin/payments"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-xs font-bold uppercase tracking-wider text-[#2E286C] transition-colors hover:bg-black/[0.03]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
        }
      />
      <CommissionsClient catalog={catalog} />
    </div>
  );
}
