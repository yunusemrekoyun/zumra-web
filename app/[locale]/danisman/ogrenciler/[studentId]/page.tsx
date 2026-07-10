import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Avatar, PageHeader } from '@/components/ui';
import { PersonJourneyPanel } from '@/components/person-journey-panel';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAdvisors } from '@/lib/server/services/candidate-pipeline';
import {
  getPersonJourney,
  getStudentJourneyContext,
} from '@/lib/server/services/person-journey';

type AdvisorStudentDetailPageProps = {
  params: Promise<{ locale: string; studentId: string }>;
};

export default async function AdvisorStudentDetailPage({
  params,
}: AdvisorStudentDetailPageProps) {
  const { locale, studentId } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const context = await getStudentJourneyContext(principal, studentId);
  if (!context) notFound();

  const [t, common, journey, advisors] = await Promise.all([
    getTranslations('admin.students'),
    getTranslations('common.status'),
    getPersonJourney(principal, context.candidateId),
    listAdvisors(principal),
  ]);
  if (!journey) notFound();

  return (
    <div className="workspace-page">
      <Link
        href="/danisman/ogrenciler"
        className="inline-flex items-center gap-2 text-xs font-bold text-[#533089]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('title')}
      </Link>

      <PageHeader
        title={context.fullName}
        description={`${context.currentLevel ?? '-'} · ${common(context.status as 'active' | 'cancelled' | 'graduated' | 'paused')}`}
        action={<Avatar name={context.fullName} size="lg" />}
      />

      <PersonJourneyPanel
        advisors={advisors}
        journey={journey}
        locale={locale}
      />
    </div>
  );
}
