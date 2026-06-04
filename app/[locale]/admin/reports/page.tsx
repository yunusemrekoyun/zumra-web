import React from 'react';
import { BarChart3, TrendingUp, Users, Target, ArrowUpRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { KpiCard, SectionHeader, Card } from '@/components/ui';
import { getDomainLanguageKey, getReportsData } from '@/lib/domain';

export default function ReportsPage() {
  const locale = useLocale();
  const t = useTranslations('admin.reports');
  const domain = useTranslations('domain');
  const { languageStats } = getReportsData('admin');

  return (
    <div className="admin-page">
      <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-4 lg:mb-8">{t('title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard
          icon={TrendingUp}
          label={t('growth')}
          value="%24"
          trend={{ label: t('growthTrend') }}
        />
        <KpiCard
          icon={Target}
          label={t('conversion')}
          value={<>68 <span className="text-lg text-[#2E286C]/30">/ 100</span></>}
          trend={{ label: t('conversionTrend') }}
        />
        <KpiCard
          icon={Users}
          label={t('retention')}
          value="%92"
          trend={{ label: t('retentionTrend') }}
        />

        <div className="bg-[#533089] rounded-3xl p-6 shadow-md text-white relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer">
          <h3 className="font-bold mb-1 z-10 relative">{t('download')}</h3>
          <p className="text-white/70 text-xs font-medium mb-6 z-10 relative">{t('reportName')}</p>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center z-10 relative group-hover:scale-110 transition-transform">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <BarChart3 className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
        </div>
      </div>

      <Card padded className="lg:!p-8">
        <SectionHeader
          title={t('languagePopularity')}
          description={t('languageDescription')}
          action={
            <select className="bg-[#F8F9FC] border border-black/5 rounded-xl px-4 py-2 text-sm font-bold text-[#2E286C] outline-none">
              <option>{t('lastSixMonths')}</option>
              <option>{t('thisYear')}</option>
            </select>
          }
          className="border-b border-black/[0.03] pb-6 mb-8"
        />

        <div className="space-y-6">
          {languageStats.map((item) => {
            const languageKey = getDomainLanguageKey(item.language);
            const languageLabel = languageKey ? domain(`languages.${languageKey}`) : item.language;

            return (
              <div key={item.language} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="sm:w-32 font-bold text-[#2E286C] text-sm">{languageLabel}</div>
                <div className="flex-1 h-8 bg-[#F8F9FC] rounded-full overflow-hidden border border-black/[0.02]">
                  <div className={`h-full bg-gradient-to-r ${item.colorClass} rounded-full`} style={{ width: `${item.percentage}%` }} />
                </div>
                <div className="sm:w-24 sm:text-right text-xs font-bold text-[#2E286C]/50">
                  {t('studentsCount', { count: new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'tr-TR').format(item.count) })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
