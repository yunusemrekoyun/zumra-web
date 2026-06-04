import { useLocale, useTranslations } from 'next-intl';
import { LessonCard, SectionHeader, StaggerContainer, StaggerItem } from '@/components/ui';
import { getDashboardData } from '@/lib/domain';

export default function DerslerPage() {
  const locale = useLocale();
  const t = useTranslations('student.lessons');
  const dashboard = getDashboardData('student');
  const getInstructorName = (teacherId: string) =>
    dashboard.users.find((user) => user.id === teacherId)?.name ?? '';
  const lessonCards = dashboard.lessons.map((lesson) => ({
    dateTime: formatLessonDateTime(lesson.startsAt, locale),
    instructor: getInstructorName(lesson.teacherId),
    status: lesson.status === 'cancelled' ? 'completed' as const : lesson.status,
    title: lesson.title,
    topic: lesson.topic,
  }));
  const upcoming = lessonCards.filter((lesson) => lesson.status === 'upcoming');
  const completed = lessonCards.filter((lesson) => lesson.status === 'completed');

  return (
    <StaggerContainer className="admin-page">
      <StaggerItem>
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">{t('title')}</h1>
        <p className="text-sm font-medium text-[#2E286C]/50 mb-6">{t('summary', { completed: completed.length, total: lessonCards.length })}</p>
      </StaggerItem>

      {upcoming.length > 0 && (
        <StaggerItem>
          <SectionHeader title={t('upcoming')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((lesson, i) => (
              <LessonCard key={i} {...lesson} />
            ))}
          </div>
        </StaggerItem>
      )}

      <StaggerItem>
        <SectionHeader title={t('past')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {completed.map((lesson, i) => (
            <LessonCard key={i} {...lesson} />
          ))}
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}

function formatLessonDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  }).format(new Date(value));
}
