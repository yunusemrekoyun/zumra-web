import { BookOpenCheck, GraduationCap, Mail, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  EmptyState,
  InfoField,
  ModulePanel,
  PageHeader,
  StatusChip,
} from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getTeacherWorkspaceData } from '@/lib/server/services/teacher-workspace';

type TeacherStudentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TeacherStudentsPage({
  params,
}: TeacherStudentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.students');
  const data = await getTeacherWorkspaceData(principal);

  return (
    <div className="workspace-page">
      <PageHeader
        title={t('title')}
        description={
          data.instructor
            ? t('description', { name: data.instructor.fullName })
            : t('missingProfileDescription')
        }
      />

      {!data.students.length ? (
        <EmptyState
          icon={GraduationCap}
          title={data.instructor ? t('emptyTitle') : t('missingProfileTitle')}
          description={
            data.instructor
              ? t('emptyDescription')
              : t('missingProfileDescription')
          }
          className="min-h-[24rem]"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.students.map((student) => (
            <ModulePanel key={student.enrollmentId} className="rounded-3xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#533089]/8">
                      <GraduationCap className="h-5 w-5 text-[#533089]" />
                    </div>
                    <div>
                      <h2 className="font-bold text-[#2E286C]">
                        {student.fullName}
                      </h2>
                      <p className="mt-1 text-xs font-medium text-[#2E286C]/45">
                        {student.programName ?? t('programPending')}
                      </p>
                    </div>
                  </div>
                </div>
                <StatusChip tone={student.status === 'active' ? 'emerald' : 'amber'}>
                  {t(`enrollmentStatuses.${student.status}`)}
                </StatusChip>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoField
                  label={t('fields.courseMode')}
                  value={t(`courseModes.${student.courseMode}`)}
                />
                <InfoField
                  label={t('fields.branch')}
                  value={student.branchName ?? t('privateLesson')}
                />
                <InfoField
                  label={t('fields.level')}
                  value={student.currentLevel ?? t('levelPending')}
                />
                <InfoField
                  label={t('fields.enrolledAt')}
                  value={formatDate(student.enrolledAt, locale)}
                />
              </div>

              <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-[#F8F9FC] p-4 text-sm font-semibold text-[#2E286C]/65">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-[#533089]" />
                  <span className="break-all">{student.email}</span>
                </span>
                {student.phone && (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#533089]" />
                    {student.phone}
                  </span>
                )}
              </div>

              <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#533089]">
                <BookOpenCheck className="h-4 w-4" />
                {student.branchName ?? t('privateLesson')}
              </div>
            </ModulePanel>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
