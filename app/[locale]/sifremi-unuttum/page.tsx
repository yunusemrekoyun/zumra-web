import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

type ForgotPasswordPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
};

export default async function ForgotPasswordPage({
  params,
}: ForgotPasswordPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.forgotPassword');

  return (
    <AuthShell description={t('description')} locale={locale} title={t('title')}>
      <ForgotPasswordForm
        locale={locale}
        labels={{
          email: t('email'),
          error: t('error'),
          submit: t('submit'),
          success: t('success'),
        }}
      />
    </AuthShell>
  );
}
