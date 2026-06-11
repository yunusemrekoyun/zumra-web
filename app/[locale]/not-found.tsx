import { getLocale, getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';

export default async function NotFoundPage() {
  const locale = await getLocale();
  const t = await getTranslations('notFound');

  return (
    <AuthShell
      description={t('description')}
      locale={locale === 'en' ? 'en' : 'tr'}
      title={t('title')}
    >
      <p className="text-sm text-[#2E286C]/60">{t('help')}</p>
    </AuthShell>
  );
}
