import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ActivationForm } from '@/components/auth/activation-form';
import { AuthShell } from '@/components/auth/auth-shell';

type ActivationPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function ActivationPage({
  params,
  searchParams,
}: ActivationPageProps) {
  const { locale } = await params;
  const { token = '' } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth.activation');

  return (
    <AuthShell
      description={t('description')}
      locale={locale}
      title={t('title')}
    >
      <ActivationForm
        token={token}
        labels={{
          confirmPassword: t('confirmPassword'),
          error: t('error'),
          mismatch: t('mismatch'),
          password: t('password'),
          submit: t('submit'),
          success: t('success'),
        }}
      />
    </AuthShell>
  );
}
