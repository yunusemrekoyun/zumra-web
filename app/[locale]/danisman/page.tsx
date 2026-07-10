import { CalendarCheck, CalendarClock, Sparkles, UserRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { EmptyState, ModulePanel, PageHeader } from '@/components/ui';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  type AppointmentOverviewRow,
  getAdvisorOverview,
} from '@/lib/server/services/advisor-overview';
import { listAdvisorTasks } from '@/lib/server/services/advisor-tasks';
import { TaskQuickPanel } from './gorevlerim/tasks-client';

type AdvisorDashboardPageProps = {
  params: Promise<{ locale: string }>;
};

const STAGE_ORDER = [
  'new',
  'contacted',
  'qualified',
  'offer_pending',
  'enrolled',
  'lost',
] as const;

export default async function AdvisorDashboardPage({
  params,
}: AdvisorDashboardPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [t, tasks, stages, overview, board] = await Promise.all([
    getTranslations('advisor.dashboard'),
    getTranslations('advisor.tasks'),
    getTranslations('admin.leads.stages'),
    getAdvisorOverview(principal),
    listAdvisorTasks(principal),
  ]);

  // "Bugünüm": vadesi geçmiş ya da bugün dolan işler önce, sonra vadesizler.
  const todayEnd = new Date(new Date().setHours(24, 0, 0, 0));
  const myToday = [
    ...board.mine.filter(
      (task) => task.dueAt && new Date(task.dueAt) <= todayEnd,
    ),
    ...board.mine.filter((task) => !task.dueAt),
  ];

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  });

  const metrics = [
    { icon: Sparkles, label: t('metricNewWeek'), value: overview.newThisWeek },
    {
      icon: CalendarClock,
      label: t('metricPending'),
      value: overview.pendingRequests.length,
    },
    {
      icon: CalendarCheck,
      label: t('metricToday'),
      value: overview.todaysMeetings.length,
    },
    { icon: UserRound, label: t('metricMine'), value: overview.myAssignedCount },
  ];

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('realDescription')} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {metrics.map((metric) => (
          <ModulePanel key={metric.label} className="rounded-3xl">
            <metric.icon className="h-5 w-5 text-[#533089]" />
            <div className="mt-4 text-3xl font-bold text-[#2E286C]">
              {metric.value}
            </div>
            <div className="mt-1 text-xs font-semibold text-[#2E286C]/50">
              {metric.label}
            </div>
          </ModulePanel>
        ))}
      </div>

      <ModulePanel className="rounded-3xl">
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
          {t('stageTitle')}
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {STAGE_ORDER.map((stage) => (
            <span
              key={stage}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F7FB] px-4 py-2 text-sm font-semibold text-[#2E286C]"
            >
              {stages(stage)}
              <span className="rounded-lg bg-[#533089]/10 px-2 py-0.5 text-xs font-bold text-[#533089]">
                {overview.stageCounts[stage] ?? 0}
              </span>
            </span>
          ))}
        </div>
      </ModulePanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <TaskQuickPanel
          emptyLabel={tasks('poolEmpty')}
          locale={locale}
          mode="pool"
          rows={board.pool}
          title={tasks('poolTitle')}
        />
        <TaskQuickPanel
          emptyLabel={tasks('todayEmpty')}
          locale={locale}
          mode="mine"
          rows={myToday}
          title={tasks('todayTitle')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppointmentListPanel
          emptyLabel={t('emptyRequests')}
          formatter={formatter}
          linkLabel={t('goToLeads')}
          mode="requested"
          rows={overview.pendingRequests}
          title={t('requestsTitle')}
        />
        <AppointmentListPanel
          emptyLabel={t('emptyUpcoming')}
          formatter={formatter}
          linkLabel={t('goToLeads')}
          mode="scheduled"
          rows={overview.upcoming}
          title={t('upcomingTitle')}
        />
      </div>
    </div>
  );
}

function AppointmentListPanel({
  emptyLabel,
  formatter,
  linkLabel,
  mode,
  rows,
  title,
}: {
  emptyLabel: string;
  formatter: Intl.DateTimeFormat;
  linkLabel: string;
  mode: 'requested' | 'scheduled';
  rows: AppointmentOverviewRow[];
  title: string;
}) {
  return (
    <ModulePanel className="rounded-3xl">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
        {title}
      </h3>
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F8F7FB] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[#2E286C]">
                  {row.candidateName}
                </div>
                <div className="text-xs font-medium text-[#2E286C]/55">
                  {mode === 'scheduled' && row.scheduledStartsAt
                    ? formatter.format(new Date(row.scheduledStartsAt))
                    : row.preferences
                        .slice(0, 2)
                        .map((preference) =>
                          formatter.format(new Date(preference)),
                        )
                        .join(' · ')}
                </div>
              </div>
              <Link
                href="/danisman/leadler"
                className="text-xs font-bold uppercase tracking-wider text-[#533089] hover:text-[#462878]"
              >
                {linkLabel}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-4 min-h-[10rem]" title={emptyLabel} description="" />
      )}
    </ModulePanel>
  );
}
