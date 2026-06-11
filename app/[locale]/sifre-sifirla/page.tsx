import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

type ResetPasswordPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
  searchParams: Promise<{ error?: string; token?: string }>;
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: ResetPasswordPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const token = query.error ? '' : query.token ?? '';
  setRequestLocale(locale);
  const t = await getTranslations('auth.resetPassword');

  return (
    <AuthShell description={t('description')} locale={locale} title={t('title')}>
      <ResetPasswordForm
        token={token}
        labels={{
          confirmPassword: t('confirmPassword'),
          error: t('error'),
          mismatch: t('mismatch'),
          password: t('password'),
          sameAsCurrent: t('sameAsCurrent'),
          submit: t('submit'),
          success: t('success'),
        }}
      />
    </AuthShell>
  );
}
