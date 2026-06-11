import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { getAuthenticatedDestination } from '@/lib/domain';
import { getSessionPrincipal } from '@/lib/server/authorization';
import { isGoogleAuthConfigured } from '@/lib/server/env';

type LoginPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
  searchParams: Promise<{ google?: string }>;
};

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const principal = await getSessionPrincipal();
  const destination = principal
    ? getAuthenticatedDestination(principal)
    : null;

  if (destination) {
    redirect(`/${locale}${destination}`);
  }

  const t = await getTranslations('auth.login');

  return (
    <AuthShell
      description={t('description')}
      locale={locale}
      title={t('title')}
    >
      <LoginForm
        googleConfigured={isGoogleAuthConfigured()}
        googleError={query.google === 'error'}
        locale={locale}
        labels={{
          error: t('error'),
          forgotPassword: t('forgotPassword'),
          google: t('google'),
          googleError: t('googleError'),
          or: t('or'),
          password: t('password'),
          rateLimited: t('rateLimited'),
          submit: t('submit'),
          username: t('username'),
        }}
      />
    </AuthShell>
  );
}
