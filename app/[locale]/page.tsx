import { routing } from '@/i18n/routing';
import PublicLandingClient from './_components/public-landing-client';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default function HomePage() {
  return <PublicLandingClient />;
}
