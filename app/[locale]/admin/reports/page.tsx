import { Target, TrendingUp, Users, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Card, KpiCard, SectionHeader } from '@/components/ui';
import { formatCents } from '@/lib/domain/money';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAdminReports } from '@/lib/server/services/admin-dashboard';

const LANGUAGE_BAR_CLASSES: Record<string, string> = {
  arabic: 'from-emerald-400 to-emerald-500',
  english: 'from-[#533089] to-[#7A5AB8]',
  french: 'from-blue-400 to-blue-500',
  german: 'from-amber-400 to-amber-500',
};

type ReportsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [t, domain, data] = await Promise.all([
    getTranslations('admin.reports'),
    getTranslations('domain'),
    getAdminReports(principal),
  ]);

  const numberFormatter = new Intl.NumberFormat(
    locale === 'en' ? 'en-US' : 'tr-TR',
  );
  const knownLanguages = new Set(['arabic', 'english', 'french', 'german']);

  return (
    <div className="admin-page">
      <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-4 lg:mb-8">
        {t('title')}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard
          icon={TrendingUp}
          label={t('newEnrollments')}
          value={data.kpis.newEnrollmentsThisMonth}
          trend={{
            direction:
              data.kpis.growthPercent == null
                ? 'neutral'
                : data.kpis.growthPercent >= 0
                  ? 'up'
                  : 'down',
            label:
              data.kpis.growthPercent == null
                ? t('growthNoBaseline')
                : t('growthVsPrev', {
                    percent: Math.abs(data.kpis.growthPercent),
                  }),
          }}
        />
        <KpiCard
          icon={Target}
          label={t('conversion')}
          value={`%${data.kpis.conversionPercent}`}
          trend={{ direction: 'neutral', label: t('conversionHint') }}
        />
        <KpiCard
          icon={Users}
          label={t('activeRate')}
          value={`%${data.kpis.activePercent}`}
          trend={{ direction: 'neutral', label: t('activeRateHint') }}
        />
        <KpiCard
          icon={Wallet}
          label={t('collected')}
          value={formatCents(data.kpis.collectedThisMonthCents)}
          trend={{ direction: 'neutral', label: t('collectedHint') }}
        />
      </div>

      <Card padded className="lg:!p-8">
        <SectionHeader
          title={t('languagePopularity')}
          description={t('languageDescription')}
          className="border-b border-black/[0.03] pb-6 mb-8"
        />
        {data.languageStats.length ? (
          <div className="space-y-6">
            {data.languageStats.map((item) => {
              const label = knownLanguages.has(item.language)
                ? domain(`languages.${item.language}` as never)
                : t('otherLanguage');
              return (
                <div
                  key={item.language}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
                >
                  <div className="sm:w-32 font-bold text-[#2E286C] text-sm">
                    {label}
                  </div>
                  <div className="flex-1 h-8 bg-[#F8F9FC] rounded-full overflow-hidden border border-black/[0.02]">
                    <div
                      className={`h-full bg-gradient-to-r ${
                        LANGUAGE_BAR_CLASSES[item.language] ??
                        'from-gray-300 to-gray-400'
                      } rounded-full`}
                      style={{ width: `${Math.max(item.percentage, 3)}%` }}
                    />
                  </div>
                  <div className="sm:w-24 sm:text-right text-xs font-bold text-[#2E286C]/50">
                    {t('studentsCount', {
                      count: numberFormatter.format(item.count),
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">{t('noData')}</p>
        )}
      </Card>

      <Card padded className="lg:!p-8">
        <SectionHeader
          title={t('advisorsTitle')}
          description={t('advisorsDescription')}
          className="border-b border-black/[0.03] pb-6 mb-6"
        />
        {data.advisors.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-[#2E286C]/40">
                  <th className="pb-3 pr-4">{t('advisorName')}</th>
                  <th className="pb-3 pr-4">{t('advisorAssigned')}</th>
                  <th className="pb-3 pr-4">{t('advisorEnrolled')}</th>
                  <th className="pb-3">{t('advisorConversion')}</th>
                </tr>
              </thead>
              <tbody>
                {data.advisors.map((advisor) => (
                  <tr
                    key={advisor.fullName}
                    className="border-t border-black/[0.03] font-semibold text-[#2E286C]"
                  >
                    <td className="py-3 pr-4">{advisor.fullName}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {advisor.assigned}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {advisor.enrolled}
                    </td>
                    <td className="py-3 tabular-nums text-[#533089]">
                      %
                      {advisor.assigned
                        ? Math.round(
                            (advisor.enrolled / advisor.assigned) * 100,
                          )
                        : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">{t('noData')}</p>
        )}
      </Card>
    </div>
  );
}
