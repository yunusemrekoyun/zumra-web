import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LevelAssessmentClient } from './level-assessment-client';

type LevelAssessmentPageProps = {
  params: Promise<{ locale: 'en' | 'tr' }>;
};

export async function generateMetadata({
  params,
}: LevelAssessmentPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publicAssessment' });
  const pathname = locale === 'tr' ? '/tr/seviye-testi' : '/en/level-test';

  return {
    alternates: {
      canonical: pathname,
      languages: {
        en: '/en/level-test',
        tr: '/tr/seviye-testi',
      },
    },
    description: t('description'),
    title: `${t('eyebrow')} | Zümra Akademi`,
  };
}

export default async function LevelAssessmentPage({
  params,
}: LevelAssessmentPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LevelAssessmentClient />;
}
