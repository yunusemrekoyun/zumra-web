import { routing } from '@/i18n/routing';
import {
  listPublicPrograms,
  type PublicProgramCard,
} from '@/lib/server/services/programs';
import PublicLandingClient from './_components/public-landing-client';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const revalidate = 300;

export default async function HomePage() {
  let programs: PublicProgramCard[] = [];
  try {
    programs = await listPublicPrograms();
  } catch {
    programs = [];
  }

  return <PublicLandingClient programs={programs} />;
}
