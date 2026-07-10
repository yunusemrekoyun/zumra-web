import { Check, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { EmptyState, ModulePanel, PageHeader, StatusChip } from '@/components/ui';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  type AppointmentOverviewRow,
  listAppointmentsOverview,
} from '@/lib/server/services/advisor-overview';

type AdvisorMeetingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorMeetingsPage({
  params,
}: AdvisorMeetingsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const [t, appointment, overview] = await Promise.all([
    getTranslations('advisor.meetings'),
    getTranslations('admin.leads.appointment'),
    listAppointmentsOverview(principal),
  ]);

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  });

  const sections: Array<{
    empty: string;
    rows: AppointmentOverviewRow[];
    title: string;
  }> = [
    {
      empty: t('emptyRequested'),
      rows: overview.requested,
      title: t('requestedTitle'),
    },
    {
      empty: t('emptyScheduled'),
      rows: overview.scheduled,
      title: t('scheduledTitle'),
    },
    { empty: t('emptyPast'), rows: overview.past, title: t('pastTitle') },
  ];

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />

      {sections.map((section) => (
        <ModulePanel key={section.title} className="rounded-3xl">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {section.title}
          </h3>
          {section.rows.length ? (
            <ul className="mt-4 space-y-3">
              {section.rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#F8F7FB] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-[#2E286C]">
                      {row.candidateName}
                    </div>
                    <div className="text-xs font-medium text-[#2E286C]/55">
                      {row.status === 'requested'
                        ? row.preferences
                            .map((preference) =>
                              formatter.format(new Date(preference)),
                            )
                            .join(' · ')
                        : row.scheduledStartsAt
                          ? formatter.format(new Date(row.scheduledStartsAt))
                          : '—'}
                    </div>
                    {row.outcomeNote && (
                      <p className="mt-1 truncate text-xs text-[#2E286C]/60">
                        {row.outcomeNote}
                      </p>
                    )}
                  </div>
                  {row.status !== 'requested' && row.status !== 'scheduled' && (
                    <StatusChip
                      tone={
                        row.status === 'completed'
                          ? 'emerald'
                          : row.status === 'no_show'
                            ? 'amber'
                            : 'red'
                      }
                      icon={
                        row.status === 'completed' ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      }
                    >
                      {appointment(`outcome_${row.status}`)}
                    </StatusChip>
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
            <EmptyState className="mt-4 min-h-[8rem]" title={section.empty} description="" />
          )}
        </ModulePanel>
      ))}
    </div>
  );
}
