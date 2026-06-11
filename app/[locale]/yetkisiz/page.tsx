import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';

type UnauthorizedPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
};

export default async function UnauthorizedPage({
  params,
}: UnauthorizedPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.unauthorized');

  return (
    <AuthShell
      description={t('description')}
      locale={locale}
      title={t('title')}
    >
      <p className="text-sm text-[#2E286C]/60">{t('help')}</p>
    </AuthShell>
  );
}
