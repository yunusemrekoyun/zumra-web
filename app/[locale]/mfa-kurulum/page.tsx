import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { MfaSetupForm } from '@/components/auth/mfa-setup-form';

type MfaSetupPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
};

export default async function MfaSetupPage({ params }: MfaSetupPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.mfaSetup');

  return (
    <AuthShell
      description={t('description')}
      locale={locale}
      title={t('title')}
    >
      <MfaSetupForm
        labels={{
          backupCodes: t('backupCodes'),
          code: t('code'),
          error: t('error'),
          password: t('password'),
          setup: t('setup'),
          submit: t('submit'),
        }}
      />
    </AuthShell>
  );
}
