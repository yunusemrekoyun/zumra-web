import { BookOpenCheck, CalendarDays, GraduationCap, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { KpiCard, ModulePanel, PageHeader, StatusChip } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getTeacherWorkspaceData } from '@/lib/server/services/teacher-workspace';

type TeacherDashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TeacherDashboardPage({
  params,
}: TeacherDashboardPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.dashboard');
  const data = await getTeacherWorkspaceData(principal);
  const groupStudents = data.students.filter(
    (student) => student.courseMode === 'group',
  ).length;
  const privateStudents = data.students.filter(
    (student) => student.courseMode === 'private',
  ).length;

  return (
    <div className="workspace-page">
      <PageHeader
        title={t('title')}
        description={
          data.instructor
            ? t('descriptionWithName', { name: data.instructor.fullName })
            : t('missingProfileDescription')
        }
      />

      <div className="workspace-kpi-grid">
        <KpiCard
          icon={Users}
          label={t('students')}
          value={data.students.length}
          variant="gradient"
        />
        <KpiCard
          icon={BookOpenCheck}
          label={t('groupStudents')}
          value={groupStudents}
        />
        <KpiCard
          icon={GraduationCap}
          label={t('privateStudents')}
          value={privateStudents}
        />
        <KpiCard
          icon={CalendarDays}
          label={t('assignedBranches')}
          value={data.branches.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ModulePanel>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#2E286C]">
                {t('branchesTitle')}
              </h2>
              <p className="mt-1 text-xs font-medium text-[#2E286C]/45">
                {t('branchesDescription')}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {data.branches.slice(0, 5).map((branch) => (
              <div key={branch.id} className="rounded-2xl bg-[#F8F9FC] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-bold text-[#2E286C]">{branch.name}</div>
                    <div className="mt-1 text-xs font-medium text-[#2E286C]/45">
                      {branch.programName} ·{' '}
                      {formatDate(branch.plannedStartDate, locale)} -{' '}
                      {formatDate(branch.plannedEndDate, locale)}
                    </div>
                  </div>
                  <StatusChip tone="purple">
                    {t('branchStudentCount', {
                      count: branch.currentEnrollmentCount,
                    })}
                  </StatusChip>
                </div>
              </div>
            ))}
            {!data.branches.length && (
              <p className="rounded-2xl bg-[#F8F9FC] p-4 text-sm font-medium text-[#2E286C]/45">
                {data.instructor ? t('noBranches') : t('missingProfileTitle')}
              </p>
            )}
          </div>
        </ModulePanel>

        <ModulePanel>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#2E286C]">
              {t('studentsTitle')}
            </h2>
            <p className="mt-1 text-xs font-medium text-[#2E286C]/45">
              {t('studentsDescription')}
            </p>
          </div>
          <div className="space-y-3">
            {data.students.slice(0, 5).map((student) => (
              <div key={student.enrollmentId} className="rounded-2xl border border-black/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-bold text-[#2E286C]">
                      {student.fullName}
                    </div>
                    <div className="mt-1 text-xs font-medium text-[#2E286C]/45">
                      {student.programName ?? t('programPending')} ·{' '}
                      {student.branchName ?? t(`courseModes.${student.courseMode}`)}
                    </div>
                  </div>
                  <StatusChip tone={student.status === 'active' ? 'emerald' : 'amber'}>
                    {t(`enrollmentStatuses.${student.status}`)}
                  </StatusChip>
                </div>
              </div>
            ))}
            {!data.students.length && (
              <p className="rounded-2xl bg-[#F8F9FC] p-4 text-sm font-medium text-[#2E286C]/45">
                {data.instructor ? t('noStudents') : t('missingProfileTitle')}
              </p>
            )}
          </div>
        </ModulePanel>
      </div>
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00Z`));
}
