import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { MfaForm } from '@/components/auth/mfa-form';

type MfaPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
};

export default async function MfaPage({ params }: MfaPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.mfa');

  return (
    <AuthShell
      description={t('description')}
      locale={locale}
      title={t('title')}
    >
      <MfaForm
        labels={{
          code: t('code'),
          error: t('error'),
          submit: t('submit'),
        }}
      />
    </AuthShell>
  );
}
