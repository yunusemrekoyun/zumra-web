import { Filter, MoreHorizontal, UsersRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  Avatar,
  Button,
  EmptyState,
  FilterTabs,
  IconButton,
  InfoField,
  ModulePanel,
  PageHeader,
  SearchInput,
} from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAdminStudents } from '@/lib/server/services/students';

type StudentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StudentsPage({ params }: StudentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [t, actions, common, domain] = await Promise.all([
    getTranslations('admin.students'),
    getTranslations('common.actions'),
    getTranslations('common.status'),
    getTranslations('domain'),
  ]);
  const students = await getAdminStudents(principal);
  const dateLocale = locale === 'en' ? 'en-US' : 'tr-TR';

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description', { count: students.length })}
        action={
          <Button className="bg-[#2E286C] hover:bg-[#2E286C]">
            {t('add')}
          </Button>
        }
      />

      <ModulePanel padded={false} className="p-2 lg:rounded-[2.5rem]">
        <div className="flex flex-col justify-between gap-4 border-b border-black/[0.03] p-4 lg:px-6 xl:flex-row xl:items-center">
          <FilterTabs
            activeValue="all"
            items={[
              { value: 'all', label: t('all') },
              { value: 'active', label: t('active') },
              { value: 'paused', label: t('paused') },
              { value: 'graduated', label: t('graduated') },
            ]}
          />
          <div className="flex w-full items-center gap-3 xl:w-auto">
            <SearchInput
              placeholder={t('search')}
              containerClassName="flex-1 xl:w-64"
              className="h-9"
            />
            <IconButton
              aria-label={actions('filter')}
              icon={<Filter className="h-4 w-4" />}
              size="sm"
            />
          </div>
        </div>

        {students.length ? (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:p-6 xl:grid-cols-3 lg:gap-6">
            {students.map((student) => (
              <Link href={`/admin/students/${student.studentId}`} key={student.enrollmentId}>
                <ModulePanel
                  variant="muted"
                  className="group flex h-full cursor-pointer flex-col transition-all hover:border-[#533089]/20 hover:shadow-lg"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={student.fullName}
                        size="lg"
                        className="bg-white shadow-sm"
                      />
                      <div>
                        <h3 className="font-bold text-[#2E286C] transition-colors group-hover:text-[#533089]">
                          {student.fullName}
                        </h3>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${getStudentStatusDotClass(student.status)}`}
                          />
                          <span className="text-xs font-medium text-[#2E286C]/50">
                            {common(student.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <IconButton
                      aria-label={actions('moreOptions')}
                      icon={<MoreHorizontal className="h-4 w-4" />}
                      size="sm"
                      className="rounded-full text-[#2E286C]/40"
                    />
                  </div>

                  <div className="relative z-10 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
                    <ModulePanel className="rounded-2xl p-3">
                      <InfoField
                        label={t('education')}
                        value={formatProgram(student, domain)}
                        valueClassName="truncate"
                      />
                      <div className="truncate text-xs font-medium text-[#2E286C]/60">
                        {student.currentLevel ?? '-'}
                      </div>
                    </ModulePanel>
                    <ModulePanel className="rounded-2xl p-3">
                      <InfoField
                        label={t('nextLesson')}
                        value={formatNextLesson(student.nextSessionAt, dateLocale)}
                        valueClassName="truncate"
                      />
                      <div className="truncate text-xs font-medium text-[#2E286C]/60">
                        {t('teacher')}: {student.instructorName ?? t('toAssign')}
                      </div>
                    </ModulePanel>
                  </div>

                  <div className="mt-auto pt-2">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/60">
                        {t('progress')}
                      </span>
                      <span className="text-xs font-bold text-[#533089]">
                        %{student.progress}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#8C6CE6] to-[#533089]"
                        style={{ width: `${student.progress}%` }}
                      />
                    </div>
                  </div>
                </ModulePanel>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UsersRound}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            className="m-4 min-h-[24rem] lg:m-6"
          />
        )}
      </ModulePanel>
    </div>
  );
}

function formatProgram(
  student: Awaited<ReturnType<typeof getAdminStudents>>[number],
  domain: Awaited<ReturnType<typeof getTranslations>>,
) {
  const language = student.language ? formatLanguage(student.language, domain) : '-';
  return student.programName ? `${language} • ${student.programName}` : language;
}

function formatLanguage(
  language: string,
  domain: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (['arabic', 'english', 'french', 'german'].includes(language)) {
    return domain(`languages.${language}`);
  }
  return language;
}

function formatNextLesson(value: string | undefined, locale: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function getStudentStatusDotClass(status: string) {
  if (status === 'active') {
    return 'bg-emerald-500';
  }

  if (status === 'graduated') {
    return 'bg-blue-500';
  }

  if (status === 'cancelled') {
    return 'bg-red-500';
  }

  return 'bg-amber-500';
}
