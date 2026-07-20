import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  Avatar,
  Card,
  KpiCard,
  PageHeader,
  SectionHeader,
  StatusChip,
} from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { getAdvisorScorecard } from '@/lib/server/services/advisor-scorecard';

const STAGE_ORDER = [
  'new',
  'contacted',
  'qualified',
  'offer_pending',
  'enrolled',
  'lost',
] as const;

type AdvisorScorecardPageProps = {
  params: Promise<{ advisorId: string; locale: string }>;
};

export default async function AdvisorScorecardPage({
  params,
}: AdvisorScorecardPageProps) {
  const { advisorId, locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);

  let data;
  try {
    data = await getAdvisorScorecard(principal, advisorId);
  } catch (error) {
    if (
      error instanceof PublicFlowError ||
      error instanceof AuthorizationDeniedError
    ) {
      notFound();
    }
    throw error;
  }

  const [t, stages] = await Promise.all([
    getTranslations('advisorScorecard'),
    getTranslations('admin.leads.stages'),
  ]);

  const dateTimeFormatter = new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' : 'tr-TR',
    { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' },
  );
  const dateFormatter = new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' : 'tr-TR',
    { day: '2-digit', month: 'short', timeZone: 'Europe/Istanbul' },
  );
  const maxWeekly = Math.max(
    1,
    ...data.weeklyActivity.map((week) => week.count),
  );

  const actionLabel = (action: string) => {
    const key = `actions.${action.replaceAll('.', '_')}`;
    return t.has(key as never)
      ? t(key as never)
      : action.replaceAll('_', ' ').replaceAll('.', ' · ');
  };

  return (
    <div className="admin-page">
      <PageHeader
        title={data.advisor.fullName}
        description={t('detailDescription')}
        action={
          <Link
            className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 py-2.5 text-xs font-bold text-[#533089] transition-colors hover:bg-[#533089]/7"
            href="/admin/danismanlar"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
        }
      />

      <Card padded>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={data.advisor.fullName} size="lg" />
          <div>
            <h2 className="text-lg font-bold text-[#2E286C]">
              {data.advisor.fullName}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-[#2E286C]/50">
              {data.advisor.email} ·{' '}
              {t('memberSince', {
                date: dateFormatter.format(new Date(data.advisor.memberSince)),
              })}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          label={t('assigned')}
          value={data.kpis.assignedCandidates}
          variant="gradient"
        />
        <KpiCard
          label={t('conversion')}
          value={`%${data.kpis.conversionPercent}`}
        />
        <KpiCard label={t('activities30d')} value={data.kpis.activities30d} />
        <KpiCard label={t('openTasks')} value={data.kpis.openTasks} />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          label={t('tasksCompleted30d')}
          value={data.kpis.tasksCompleted30d}
        />
        <KpiCard
          label={t('appointmentsScheduled30d')}
          value={data.kpis.appointmentsScheduled30d}
        />
        <KpiCard
          label={t('appointmentsCompleted30d')}
          value={data.kpis.appointmentsCompleted30d}
        />
        <KpiCard
          label={t('enrolledCandidates')}
          value={data.kpis.enrolledCandidates}
        />
      </div>

      <Card padded>
        <SectionHeader title={t('stageTitle')} />
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER.map((stage) => (
            <span
              key={stage}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 py-2 text-sm font-semibold text-[#2E286C]"
            >
              {stages(stage)}
              <span className="rounded-lg bg-[#533089]/10 px-2 py-0.5 text-xs font-bold text-[#533089]">
                {data.stageCounts[stage] ?? 0}
              </span>
            </span>
          ))}
        </div>
      </Card>

      <Card padded>
        <SectionHeader
          title={t('weeklyTitle')}
          description={t('weeklyDescription')}
        />
        {data.weeklyActivity.length ? (
          <div className="flex h-28 items-end gap-2">
            {data.weeklyActivity.map((week) => (
              <div
                key={week.weekStart}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${week.weekStart}: ${week.count}`}
              >
                <span className="text-[10px] font-bold text-[#2E286C]/45">
                  {week.count}
                </span>
                <div
                  className="w-full rounded-t bg-[#533089]/80"
                  style={{
                    height: `${Math.max(6, (week.count / maxWeekly) * 80)}px`,
                  }}
                />
                <span className="text-[9px] font-semibold text-[#2E286C]/35">
                  {dateFormatter.format(new Date(`${week.weekStart}T12:00:00`))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">
            {t('noActivity')}
          </p>
        )}
      </Card>

      <Card padded>
        <SectionHeader
          title={t('feedTitle')}
          description={t('feedDescription')}
        />
        {data.activityFeed.length ? (
          <div className="space-y-2">
            {data.activityFeed.map((entry, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F8F9FC] px-4 py-3"
              >
                <span className="text-sm font-semibold text-[#2E286C]">
                  {actionLabel(entry.action)}
                </span>
                <span className="flex items-center gap-3">
                  {entry.result !== 'success' && (
                    <StatusChip tone="red">{entry.result}</StatusChip>
                  )}
                  <span className="text-xs font-semibold text-[#2E286C]/45">
                    {dateTimeFormatter.format(new Date(entry.createdAt))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">
            {t('noActivity')}
          </p>
        )}
      </Card>
    </div>
  );
}
