import { notFound } from 'next/navigation';
import {
  getPublishedLegalPage,
  listFooterLegalPages,
} from '@/lib/server/services/legal-pages';
import { LegalPageView } from './legal-page-view';

// Admin edits/publishes should show immediately; content is DB-driven.
export const dynamic = 'force-dynamic';

type LegalSlugPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function toLegalLocale(locale: string): 'tr' | 'en' {
  return locale === 'en' ? 'en' : 'tr';
}

export async function generateMetadata({ params }: LegalSlugPageProps) {
  const { locale, slug } = await params;
  const page = await getPublishedLegalPage(slug, toLegalLocale(locale)).catch(
    () => null,
  );
  return page ? { title: page.title } : {};
}

export default async function LegalSlugPage({ params }: LegalSlugPageProps) {
  const { locale, slug } = await params;
  const legalLocale = toLegalLocale(locale);

  const page = await getPublishedLegalPage(slug, legalLocale).catch(() => null);
  if (!page) {
    notFound();
  }

  const links = await listFooterLegalPages(legalLocale).catch(() => []);

  return <LegalPageView page={page} links={links} />;
}
