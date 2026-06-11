import { Plus, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Avatar, Button, Card, IconButton, KpiCard, SectionHeader, StatusChip, TimelineItem } from '@/components/ui';
import {
  getDashboardData,
  getDomainLanguageKey,
  getDomainRelativeKey,
} from '@/lib/domain';
import { requireWorkspaceRole } from '@/lib/server/authorization';

/* ─── Data ────────────────────────────────────────────────────────── */

const leadStatusMeta = {
  contacted: { labelKey: 'contacted', tone: 'blue' as const },
  converted: { labelKey: 'converted', tone: 'emerald' as const },
  lost: { labelKey: 'lost', tone: 'gray' as const },
  meeting_scheduled: { labelKey: 'meeting_scheduled', tone: 'amber' as const },
  new: { labelKey: 'new', tone: 'emerald' as const },
  offer_pending: { labelKey: 'offer_pending', tone: 'amber' as const },
};

/* ─── Component ───────────────────────────────────────────────────── */

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;
  await requireWorkspaceRole('admin', locale);

  return <AdminPageContent />;
}

function AdminPageContent() {
  const locale = useLocale();
  const t = useTranslations('admin.dashboard');
  const status = useTranslations('domain.leadStatus');
  const domain = useTranslations('domain');
  const common = useTranslations('common.actions');
  const dashboard = getDashboardData('admin');
  const leads = dashboard.leads.map((lead) => {
    const languageKey = getDomainLanguageKey(lead.interestedProgram);
    const relativeKey = getDomainRelativeKey(lead.lastActivityLabel);
    const program = languageKey ? domain(`languages.${languageKey}`) : lead.interestedProgram;

    return {
      id: lead.id,
      name: lead.fullName,
      program: `${program}${lead.level ? ` • ${lead.level}` : ''}`,
      statusKey: leadStatusMeta[lead.status].labelKey,
      time: relativeKey ? domain(`relative.${relativeKey}`) : lead.lastActivityLabel,
      tone: leadStatusMeta[lead.status].tone,
    };
  });
  const schedule = dashboard.meetings.map((meeting) => {
    const lead = meeting.leadId
      ? dashboard.leads.find((item) => item.id === meeting.leadId)
      : undefined;
    const student = meeting.studentId
      ? dashboard.students.find((item) => item.id === meeting.studentId)
      : undefined;
    const participantName = lead?.fullName ?? student?.fullName ?? meeting.title;

    return {
      id: meeting.id,
      time: new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(meeting.startsAt)),
      title: lead
        ? t('meetingIntake', { name: participantName })
        : t('meetingLevel', { name: participantName }),
      tone: 'brand' as const,
    };
  });

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
          value={dashboard.students.length}
          trend={{ direction: 'up', label: t('trendMonth') }}
        />
        <KpiCard
          label={t('activeStudents')}
          value={dashboard.students.filter((student) => student.status === 'active').length}
          trend={{ direction: 'up', label: t('trendWeek') }}
        />
        <KpiCard
          label={t('newApplications')}
          value={dashboard.leads.length}
          trend={{ label: t('waiting'), direction: 'neutral' }}
        />
        <KpiCard
          label={t('conversionRate')}
          value="%68"
          trend={{ direction: 'up', label: t('goodLevel') }}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        {/* Recent Leads */}
        <Card className="xl:col-span-2" padded>
          <SectionHeader
            title={t('recentLeads')}
            action={
              <Button variant="ghost" size="sm" className="normal-case tracking-normal">
                {common('viewAll')}
              </Button>
            }
          />
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-4 rounded-2xl border border-black/[0.03] hover:shadow-md transition-shadow cursor-pointer bg-white group"
              >
                <div className="flex items-center gap-4">
                  <Avatar name={lead.name} />
                  <div>
                    <div className="font-bold text-[#2E286C] mb-0.5 group-hover:text-[#533089] transition-colors">
                      {lead.name}
                    </div>
                    <div className="text-xs text-[#2E286C]/50 font-medium">{lead.program}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusChip tone={lead.tone}>{status(lead.statusKey)}</StatusChip>
                  <div className="text-xs text-[#2E286C]/40 font-medium">{lead.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Schedule */}
        <Card padded>
          <SectionHeader
            title={t('todaySchedule')}
            action={
              <IconButton
                aria-label={common('add')}
                icon={<Plus className="w-4 h-4" />}
                size="sm"
                variant="ghost"
                className="rounded-full bg-[#F8F9FC]"
              />
            }
          />
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-black/[0.03]" />
            <div className="space-y-6 relative z-10">
              {schedule.map((item) => (
                <TimelineItem key={item.id} time={item.time} title={item.title} tone={item.tone} />
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
