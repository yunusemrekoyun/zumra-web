import { Target } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { EmptyState, ModulePanel, PageHeader, StatusChip } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listCandidateDirectory } from '@/lib/server/services/candidate-directory';

type AdvisorOffersPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorOffersPage({
  params,
}: AdvisorOffersPageProps) {
  const { locale } = await params;
  await requireWorkspaceRole('advisor', locale);
  const [t, stages, candidates] = await Promise.all([
    getTranslations('advisor.offers'),
    getTranslations('admin.leads.stages'),
    listCandidateDirectory(),
  ]);

  // "Teklif masasında" olanlar: teklif aşamasındaki adaylar + yarım kalmış
  // kayıt taslağı olan herkes (aşaması ne olursa olsun).
  const rows = candidates.filter(
    (candidate) =>
      candidate.stage === 'offer_pending' ||
      (candidate.activeEnrollmentDraft &&
        candidate.stage !== 'enrolled' &&
        candidate.stage !== 'lost'),
  );

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />

      <ModulePanel className="rounded-3xl">
        {rows.length ? (
          <ul className="space-y-3">
            {rows.map((candidate) => (
              <li
                key={candidate.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#F8F7FB] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#2E286C]">
                    {candidate.fullName}
                  </div>
                  <div className="text-xs font-medium text-[#2E286C]/55">
                    {candidate.email}
                    {candidate.advisorName ? ` · ${candidate.advisorName}` : ''}
                  </div>
                </div>
                <StatusChip tone={candidate.stage === 'offer_pending' ? 'amber' : 'purple'}>
                  {stages(candidate.stage)}
                </StatusChip>
                {candidate.activeEnrollmentDraft && (
                  <StatusChip tone="purple">{t('draftInProgress')}</StatusChip>
                )}
                <Link
                  href="/danisman/leadler"
                  className="text-xs font-bold uppercase tracking-wider text-[#533089] hover:text-[#462878]"
                >
                  {t('open')}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Target}
            className="min-h-[16rem]"
            title={t('emptyTitle')}
            description={t('emptyDescription')}
          />
        )}
      </ModulePanel>
    </div>
  );
}
