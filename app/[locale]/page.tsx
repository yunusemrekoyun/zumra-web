import { routing } from '@/i18n/routing';
import {
  listFooterLegalPages,
  type FooterLegalLink,
} from '@/lib/server/services/legal-pages';
import {
  listPublicPrograms,
  type PublicProgramCard,
} from '@/lib/server/services/programs';
import PublicLandingClient from './_components/public-landing-client';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const revalidate = 300;

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const legalLocale = locale === 'en' ? 'en' : 'tr';

  let programs: PublicProgramCard[] = [];
  let legalLinks: FooterLegalLink[] = [];
  try {
    programs = await listPublicPrograms();
  } catch {
    programs = [];
  }
  try {
    legalLinks = await listFooterLegalPages(legalLocale);
  } catch {
    legalLinks = [];
  }

  return <PublicLandingClient programs={programs} legalLinks={legalLinks} />;
}
