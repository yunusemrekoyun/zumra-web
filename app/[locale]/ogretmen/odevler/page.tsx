import { CalendarClock, ClipboardList, Plus, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EmptyState, ModulePanel, PageHeader, StatusChip } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listInstructorAssignments } from '@/lib/server/services/assignments';

type TeacherAssignmentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TeacherAssignmentsPage({
  params,
}: TeacherAssignmentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.assignments');
  const assignments = await listInstructorAssignments(principal);

  return (
    <div className="workspace-page">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <a
            href={`/${locale}/ogretmen/odevler/yeni`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#533089] px-5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-[#533089]/20 transition-all hover:bg-[#462878]"
          >
            <Plus className="h-4 w-4" />
            {t('new')}
          </a>
        }
      />

      {!assignments.length ? (
        <EmptyState
          icon={ClipboardList}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          className="min-h-[24rem]"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {assignments.map((assignment) => (
            <a
              key={assignment.id}
              href={`/${locale}/ogretmen/odevler/${assignment.id}`}
              className="block"
            >
              <ModulePanel className="rounded-3xl transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#533089]/8">
                      <ClipboardList className="h-5 w-5 text-[#533089]" />
                    </div>
                    <div>
                      <h2 className="font-bold text-[#2E286C]">
                        {assignment.title}
                      </h2>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#2E286C]/45">
                        <Users className="h-3.5 w-3.5" />
                        {assignment.targetLabel}
                      </p>
                    </div>
                  </div>
                  <StatusChip
                    tone={assignment.requiresSubmission ? 'purple' : 'blue'}
                  >
                    {assignment.requiresSubmission
                      ? t('type.assignment')
                      : t('type.material')}
                  </StatusChip>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {assignment.dueAt && (
                    <StatusChip tone="gray" icon={<CalendarClock className="h-3 w-3" />}>
                      {formatDate(assignment.dueAt, locale)}
                    </StatusChip>
                  )}
                  {assignment.requiresSubmission && (
                    <>
                      <StatusChip tone="amber">
                        {t('submittedCount', {
                          submitted: assignment.submittedCount,
                          expected: assignment.expectedCount,
                        })}
                      </StatusChip>
                      <StatusChip tone="emerald">
                        {t('gradedCount', { graded: assignment.gradedCount })}
                      </StatusChip>
                    </>
                  )}
                </div>
              </ModulePanel>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}
