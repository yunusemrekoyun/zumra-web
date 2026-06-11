import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { GoogleCompletion } from '@/components/auth/google-completion';

type GoogleCompletionPageProps = {
  params: Promise<{ locale: 'tr' | 'en' }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function GoogleCompletionPage({
  params,
  searchParams,
}: GoogleCompletionPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const mode = query.mode === 'link' ? 'link' : 'signin';
  setRequestLocale(locale);
  const t = await getTranslations('auth.googleCompletion');

  return (
    <AuthShell description={t('description')} locale={locale} title={t('title')}>
      <GoogleCompletion
        labels={{
          error: t('error'),
          pending: t('pending'),
        }}
        locale={locale}
        mode={mode}
      />
    </AuthShell>
  );
}
