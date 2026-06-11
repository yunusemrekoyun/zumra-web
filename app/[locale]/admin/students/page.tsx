import React from 'react';
import { Filter, MoreHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Avatar, Button, FilterTabs, IconButton, InfoField, ModulePanel, PageHeader, SearchInput } from '@/components/ui';
import { getDashboardData, getDomainLanguageKey } from '@/lib/domain';
import { withWorkspacePage } from '@/lib/server/workspace-page';

function StudentsPage() {
  const locale = useLocale();
  const t = useTranslations('admin.students');
  const actions = useTranslations('common.actions');
  const common = useTranslations('common.status');
  const domain = useTranslations('domain');
  const dashboard = getDashboardData('admin');
  const students = dashboard.students.map((student) => {
    const languageKey = getDomainLanguageKey(student.language);
    const teachers = dashboard.users
      .filter((user) => student.teacherIds.includes(user.id))
      .map((user) => user.name);

    return {
      id: student.id,
      name: student.fullName,
      lang: languageKey ? domain(`languages.${languageKey}`) : student.language,
      level: student.level,
      instructor: teachers.length ? teachers.join(', ') : t('toAssign'),
      progress: student.progress,
      status: common(student.status),
      statusDotClass: getStudentStatusDotClass(student.status),
      next: student.nextSessionAt
        ? new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            month: 'short',
          }).format(new Date(student.nextSessionAt))
        : '-',
    };
  });

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description', { count: students.length })}
        action={(
          <Button className="bg-[#2E286C] hover:bg-[#2E286C]">
          {t('add')}
          </Button>
        )}
      />

      <ModulePanel padded={false} className="lg:rounded-[2.5rem] p-2">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 lg:px-6 border-b border-black/[0.03]">
          <FilterTabs
            activeValue="all"
            items={[
              { value: 'all', label: t('all') },
              { value: 'active', label: t('active') },
              { value: 'paused', label: t('paused') },
              { value: 'graduated', label: t('graduated') },
            ]}
          />
          <div className="flex items-center gap-3 w-full xl:w-auto">
            <SearchInput placeholder={t('search')} containerClassName="flex-1 xl:w-64" className="h-9" />
            <IconButton aria-label={actions('filter')} icon={<Filter className="w-4 h-4" />} size="sm" />
          </div>
        </div>

        <div className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {students.map((student) => (
            <Link href={`/admin/students/${student.id}`} key={student.id}>
              <ModulePanel variant="muted" className="hover:shadow-lg hover:border-[#533089]/20 transition-all cursor-pointer group flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={student.name} size="lg" className="bg-white shadow-sm" />
                    <div>
                      <h3 className="font-bold text-[#2E286C] group-hover:text-[#533089] transition-colors">{student.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${student.statusDotClass}`} />
                        <span className="text-xs text-[#2E286C]/50 font-medium">{student.status}</span>
                      </div>
                    </div>
                  </div>
                  <IconButton
                    aria-label={actions('moreOptions')}
                    icon={<MoreHorizontal className="w-4 h-4" />}
                    size="sm"
                    className="rounded-full text-[#2E286C]/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 mb-6 relative z-10">
                  <ModulePanel className="rounded-2xl p-3">
                    <InfoField
                      label={t('education')}
                      value={student.lang}
                      valueClassName="truncate"
                    />
                    <div className="text-xs text-[#2E286C]/60 font-medium truncate">{student.level}</div>
                  </ModulePanel>
                  <ModulePanel className="rounded-2xl p-3">
                    <InfoField
                      label={t('nextLesson')}
                      value={student.next}
                      valueClassName="truncate"
                    />
                    <div className="text-xs text-[#2E286C]/60 font-medium truncate">{t('teacher')}: {student.instructor}</div>
                  </ModulePanel>
                </div>

                <div className="mt-auto pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#2E286C]/60">{t('progress')}</span>
                    <span className="text-xs font-bold text-[#533089]">%{student.progress}</span>
                  </div>
                  <div className="h-2.5 bg-black/5 rounded-full overflow-hidden w-full">
                    <div
                      className="h-full bg-gradient-to-r from-[#8C6CE6] to-[#533089] rounded-full"
                      style={{ width: `${student.progress}%` }}
                    />
                  </div>
                </div>
              </ModulePanel>
            </Link>
          ))}
        </div>
      </ModulePanel>
    </div>
  );
}

export default withWorkspacePage('admin', StudentsPage);

function getStudentStatusDotClass(status: string) {
  if (status === 'active') {
    return 'bg-emerald-500';
  }

  if (status === 'graduated') {
    return 'bg-blue-500';
  }

  if (status === 'candidate') {
    return 'bg-purple-500';
  }

  return 'bg-amber-500';
}
