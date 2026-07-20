import { ArrowRight, ClipboardList, Sparkles, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Avatar, ModulePanel, PageHeader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAdvisorScorecards } from '@/lib/server/services/advisor-scorecard';

type AdvisorsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorsPage({ params }: AdvisorsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [t, scorecards] = await Promise.all([
    getTranslations('advisorScorecard'),
    listAdvisorScorecards(principal),
  ]);

  const dateFormatter = new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' : 'tr-TR',
    { day: '2-digit', month: 'short', timeZone: 'Europe/Istanbul' },
  );

  return (
    <div className="admin-page">
      <PageHeader title={t('title')} description={t('description')} />

      {scorecards.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {scorecards.map((advisor) => (
            <ModulePanel key={advisor.userId} className="rounded-3xl">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={advisor.fullName} />
                  <div>
                    <h2 className="font-bold text-[#2E286C]">
                      {advisor.fullName}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#2E286C]/45">
                      {advisor.email}
                    </p>
                  </div>
                </div>
                <Link
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#533089] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#43236f]"
                  href={`/admin/danismanlar/${advisor.userId}`}
                >
                  {t('viewScorecard')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat
                  icon={<Users className="h-4 w-4 text-[#533089]" />}
                  label={t('assigned')}
                  value={String(advisor.assignedCandidates)}
                />
                <MiniStat
                  icon={<Sparkles className="h-4 w-4 text-[#533089]" />}
                  label={t('conversion')}
                  value={`%${advisor.conversionPercent}`}
                />
                <MiniStat
                  icon={<ClipboardList className="h-4 w-4 text-[#533089]" />}
                  label={t('openTasks')}
                  value={String(advisor.openTasks)}
                />
                <MiniStat
                  icon={<Sparkles className="h-4 w-4 text-[#533089]" />}
                  label={t('activities30d')}
                  value={String(advisor.activities30d)}
                />
              </div>

              <p className="mt-4 text-xs font-semibold text-[#2E286C]/45">
                {advisor.lastActivityAt
                  ? t('lastActivity', {
                      date: dateFormatter.format(
                        new Date(advisor.lastActivityAt),
                      ),
                    })
                  : t('noActivity')}
              </p>
            </ModulePanel>
          ))}
        </div>
      ) : (
        <p className="text-sm font-medium text-[#2E286C]/45">{t('empty')}</p>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#F8F9FC] p-3">
      {icon}
      <div className="mt-2 text-xl font-bold tabular-nums text-[#2E286C]">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-[#2E286C]/50">
        {label}
      </div>
    </div>
  );
}
