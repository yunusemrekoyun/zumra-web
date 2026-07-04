import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { DeviceVerificationForm } from '@/components/auth/device-verification-form';

type DeviceVerificationPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
  searchParams: Promise<{ challenge?: string; to?: string }>;
};

export default async function DeviceVerificationPage({
  params,
  searchParams,
}: DeviceVerificationPageProps) {
  const { locale } = await params;
  const { challenge = '', to = '/' } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth.device');

  return (
    <AuthShell
      description={t('description')}
      locale={locale}
      title={t('title')}
    >
      <DeviceVerificationForm
        challengeId={challenge}
        destination={to.startsWith('/') ? to : '/'}
        labels={{
          code: t('code'),
          error: t('error'),
          rateLimited: t('rateLimited'),
          sessionExpired: t('sessionExpired'),
          restart: t('restart'),
          submit: t('submit'),
        }}
      />
    </AuthShell>
  );
}
