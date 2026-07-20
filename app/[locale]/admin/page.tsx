import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { LucideIcon } from 'lucide-react';
import {
  Avatar,
  Card,
  KpiCard,
  SectionHeader,
  StatusChip,
  TimelineItem,
} from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAdminDashboard } from '@/lib/server/services/admin-dashboard';

const STAGE_TONES: Record<
  string,
  'emerald' | 'amber' | 'blue' | 'gray' | 'purple'
> = {
  contacted: 'blue',
  enrolled: 'emerald',
  lost: 'gray',
  new: 'emerald',
  offer_pending: 'amber',
  qualified: 'purple',
};

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [t, stages, common, data] = await Promise.all([
    getTranslations('admin.dashboard'),
    getTranslations('admin.leads.stages'),
    getTranslations('common.actions'),
    getAdminDashboard(principal),
  ]);

  const timeFormatter = new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' : 'tr-TR',
    { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' },
  );
  const activityFormatter = new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' : 'tr-TR',
    { day: '2-digit', month: 'short', timeZone: 'Europe/Istanbul' },
  );

  const alerts: Array<{
    count: number;
    href?: string;
    icon: LucideIcon;
    label: string;
  }> = [
    {
      count: data.alerts.pendingPaymentReports,
      href: '/admin/payments',
      icon: Wallet,
      label: t('alertPayments'),
    },
    {
      count: data.alerts.pendingChangeRequests,
      href: '/admin/calendar',
      icon: CalendarClock,
      label: t('alertChangeRequests'),
    },
    {
      count: data.alerts.overdueInstallments,
      href: '/admin/payments',
      icon: AlertTriangle,
      label: t('alertInstallments'),
    },
    {
      count: data.alerts.tasksDue,
      icon: ClipboardList,
      label: t('alertTasks'),
    },
  ];
  const openAlerts = alerts.filter((alert) => alert.count > 0);

  return (
    <div className="admin-page">
      <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-4 lg:mb-8">
        {t('greeting')}
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard
          variant="gradient"
          icon={Users}
          label={t('totalStudents')}
          value={data.kpis.totalStudents}
        />
        <KpiCard
          label={t('activeStudents')}
          value={data.kpis.activeStudents}
        />
        <KpiCard
          icon={UserPlus}
          label={t('newApplications')}
          value={data.kpis.newCandidates30d}
        />
        <KpiCard
          label={t('conversionRate')}
          value={`%${data.kpis.conversionPercent}`}
        />
      </div>

      {/* Pending work alerts */}
      <Card padded>
        <SectionHeader title={t('alertsTitle')} />
        {openAlerts.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {openAlerts.map((alert) => {
              const content = (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/15 bg-amber-50/60 px-4 py-3 transition-colors hover:bg-amber-50">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[#2E286C]">
                    <alert.icon className="h-4 w-4 text-amber-600" />
                    {alert.label}
                  </span>
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-white">
                    {alert.count}
                  </span>
                </div>
              );
              return alert.href ? (
                <Link href={alert.href} key={alert.label}>
                  {content}
                </Link>
              ) : (
                <div key={alert.label}>{content}</div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">
            {t('alertsEmpty')}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        {/* Recent candidates */}
        <Card className="xl:col-span-2" padded>
          <SectionHeader
            title={t('recentLeads')}
            action={
              <Link
                className="rounded-xl px-3 py-1.5 text-sm font-bold text-[#533089] transition-colors hover:bg-[#533089]/7"
                href="/admin/leads"
              >
                {common('viewAll')}
              </Link>
            }
          />
          {data.recentCandidates.length ? (
            <div className="space-y-3">
              {data.recentCandidates.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/admin/leads/${candidate.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl border border-black/[0.03] hover:shadow-md transition-shadow bg-white group"
                >
                  <div className="flex items-center gap-4">
                    <Avatar name={candidate.fullName} />
                    <div className="font-bold text-[#2E286C] group-hover:text-[#533089] transition-colors">
                      {candidate.fullName}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusChip tone={STAGE_TONES[candidate.stage] ?? 'gray'}>
                      {stages(candidate.stage as never)}
                    </StatusChip>
                    <div className="text-xs text-[#2E286C]/40 font-medium">
                      {activityFormatter.format(
                        new Date(candidate.lastActivityAt),
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-[#2E286C]/45">
              {t('leadsEmpty')}
            </p>
          )}
        </Card>

        {/* Today's lessons */}
        <Card padded>
          <SectionHeader
            title={t('todaySchedule')}
            action={
              <Link
                className="rounded-xl px-3 py-1.5 text-sm font-bold text-[#533089] transition-colors hover:bg-[#533089]/7"
                href="/admin/calendar"
              >
                {common('viewAll')}
              </Link>
            }
          />
          {data.todayLessons.length ? (
            <div className="relative">
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-black/[0.03]" />
              <div className="space-y-6 relative z-10">
                {data.todayLessons.map((lesson) => (
                  <TimelineItem
                    key={lesson.id}
                    time={timeFormatter.format(new Date(lesson.startsAt))}
                    title={
                      lesson.instructorName
                        ? `${lesson.title} — ${lesson.instructorName}`
                        : lesson.title
                    }
                    tone="brand"
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-[#2E286C]/45">
              {t('todayEmpty')}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
