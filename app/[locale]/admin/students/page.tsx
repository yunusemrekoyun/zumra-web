import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/ui';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getAdminStudents } from '@/lib/server/services/students';
import { AdminStudentsClient, type AdminStudentCard } from './students-client';

type StudentsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StudentsPage({ params }: StudentsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [t, common, domain] = await Promise.all([
    getTranslations('admin.students'),
    getTranslations('common.status'),
    getTranslations('domain'),
  ]);
  const students = await getAdminStudents(principal);
  const dateLocale = locale === 'en' ? 'en-US' : 'tr-TR';

  const cards: AdminStudentCard[] = students.map((student) => ({
    enrollmentId: student.enrollmentId,
    fullName: student.fullName,
    instructorLabel: student.instructorName ?? t('toAssign'),
    levelLabel: student.currentLevel ?? '-',
    nextLessonLabel: formatNextLesson(student.nextSessionAt, dateLocale),
    programLabel: formatProgram(student, domain),
    progress: student.progress,
    status: student.status,
    statusLabel: common(student.status),
    studentId: student.studentId,
  }));

  return (
    <div className="admin-page">
      <PageHeader
        title={t('title')}
        description={t('description', { count: students.length })}
        action={
          <Link
            href="/admin/leads"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2E286C] px-5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-[#2E286C]/20 transition-all hover:bg-[#241F5A]"
          >
            {t('add')}
          </Link>
        }
      />

      <AdminStudentsClient
        students={cards}
        labels={{
          all: t('all'),
          active: t('active'),
          paused: t('paused'),
          graduated: t('graduated'),
          education: t('education'),
          nextLesson: t('nextLesson'),
          teacher: t('teacher'),
          progress: t('progress'),
          search: t('search'),
          emptyTitle: t('emptyTitle'),
          emptyDescription: t('emptyDescription'),
          noMatches: t('noMatches'),
        }}
      />
    </div>
  );
}

function formatProgram(
  student: Awaited<ReturnType<typeof getAdminStudents>>[number],
  domain: Awaited<ReturnType<typeof getTranslations>>,
) {
  const language = student.language
    ? formatLanguage(student.language, domain)
    : '-';
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
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}
