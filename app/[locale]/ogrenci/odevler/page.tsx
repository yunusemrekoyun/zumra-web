import { CalendarClock, ClipboardList, GraduationCap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EmptyState, ModulePanel, PageHeader, StatusChip } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  listStudentAssignments,
  type StudentAssignmentStatus,
} from '@/lib/server/services/assignments';

const statusTone: Record<
  StudentAssignmentStatus,
  'emerald' | 'blue' | 'amber' | 'gray'
> = {
  graded: 'emerald',
  material: 'blue',
  not_submitted: 'amber',
  submitted: 'blue',
};

type StudentAssignmentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StudentAssignmentsPage({
  params,
}: StudentAssignmentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const t = await getTranslations('student.assignments');
  const assignments = await listStudentAssignments(principal);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />

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
              href={`/${locale}/ogrenci/odevler/${assignment.id}`}
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
                        <GraduationCap className="h-3.5 w-3.5" />
                        {assignment.instructorName}
                      </p>
                    </div>
                  </div>
                  <StatusChip tone={statusTone[assignment.status]}>
                    {assignment.status === 'graded' && assignment.score != null
                      ? t('status.gradedScore', {
                          score: assignment.score,
                          max: assignment.maxScore ?? 100,
                        })
                      : t(`status.${assignment.status}`)}
                  </StatusChip>
                </div>

                {(assignment.dueAt || assignment.isLate) && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {assignment.dueAt && (
                      <StatusChip
                        tone="gray"
                        icon={<CalendarClock className="h-3 w-3" />}
                      >
                        {formatDate(assignment.dueAt, locale)}
                      </StatusChip>
                    )}
                    {assignment.isLate && (
                      <StatusChip tone="red">{t('status.late')}</StatusChip>
                    )}
                  </div>
                )}
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
