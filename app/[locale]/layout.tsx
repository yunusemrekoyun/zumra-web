import type { Metadata } from 'next';
import { Playfair_Display, Manrope } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getLocalizedAlternates } from '@/i18n/metadata';
import '../globals.css';

const rosmatikaFallback = Playfair_Display({ subsets: ['latin'], variable: '--font-rosmatika' });
const neubauFallback = Manrope({ subsets: ['latin'], variable: '--font-neubau' });

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safeLocale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: getLocalizedAlternates(safeLocale, '/'),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${rosmatikaFallback.variable} ${neubauFallback.variable}`}>
      <body className="antialiased selection:bg-brand-primary selection:text-white" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
