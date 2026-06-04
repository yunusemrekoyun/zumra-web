import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Avatar, Button, Card, SectionHeader, StreakBadge, LessonCard, StaggerContainer, StaggerItem } from '@/components/ui';
import { getDashboardData, getDomainLanguageKey, getStudentProgressData } from '@/lib/domain';

export default function StudentDashboard() {
  const locale = useLocale();
  const t = useTranslations('student.dashboard');
  const domain = useTranslations('domain');
  const common = useTranslations('common.actions');
  const studentDashboardData = getDashboardData('student');
  const progress = getStudentProgressData('student');
  const currentStudent = studentDashboardData.students[0];
  const studentLessons = studentDashboardData.lessons.filter((lesson) => lesson.studentId === currentStudent.id);
  const languageKey = getDomainLanguageKey(currentStudent.language);
  const studentLanguage = languageKey ? domain(`languages.${languageKey}`) : currentStudent.language;
  const getInstructorName = (teacherId: string) =>
    studentDashboardData.users.find((user) => user.id === teacherId)?.name ?? '';
  const upcomingLessons = studentLessons
    .filter((lesson) => lesson.status === 'upcoming')
    .map((lesson) => ({
      title: lesson.title,
      instructor: getInstructorName(lesson.teacherId),
      dateTime: formatLessonDate(lesson.startsAt, locale),
      status: 'upcoming' as const,
      topic: lesson.topic,
    }));
  const recentLessons = studentLessons
    .filter((lesson) => lesson.status === 'completed')
    .map((lesson) => ({
      title: lesson.title,
      instructor: getInstructorName(lesson.teacherId),
      dateTime: formatLessonDate(lesson.startsAt, locale),
      status: 'completed' as const,
      topic: lesson.topic,
    }));
  const nextLesson = upcomingLessons[0];
  const nextLessonTitle = nextLesson
    ? `${nextLesson.title} - ${nextLesson.topic}`
    : t('noUpcomingLesson');
  const nextLessonMeta = nextLesson
    ? `${nextLesson.instructor} • ${nextLesson.dateTime}`
    : common('soon');

  return (
    <StaggerContainer className="admin-page">
      {/* Welcome card */}
      <StaggerItem>
        <Card variant="gradient" className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <Avatar name={currentStudent.fullName} size="lg" variant="brand" className="border-4 border-white/20" />
              <div>
                <h1 className="text-xl lg:text-2xl font-rosmatika font-medium text-white">{t('hello', { name: currentStudent.fullName.split(' ')[0] })}</h1>
                <p className="text-white/70 text-sm font-medium mt-0.5">{currentStudent.level} • {studentLanguage}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StreakBadge count={progress?.streak ?? 0} />
              <span className="text-white/60 text-xs font-medium">{t('encouragement')}</span>
            </div>
          </div>
          <BookOpen className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5" />
        </Card>
      </StaggerItem>

      {/* Next lesson highlight */}
      <StaggerItem>
        <Card padded className="border-l-4 border-l-[#533089]">
          <SectionHeader
            title={t('nextLesson')}
            action={
              <Button variant="ghost" size="sm" className="normal-case tracking-normal">
                {common('joinLesson')} <ArrowRight className="w-4 h-4" />
              </Button>
            }
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-[#2E286C] text-lg">
                {nextLessonTitle}
              </h3>
              <p className="text-sm text-[#2E286C]/50 font-medium mt-1">
                {nextLessonMeta}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                {t('timeLeft')}
              </div>
            </div>
          </div>
        </Card>
      </StaggerItem>

      {/* Upcoming lessons */}
      <StaggerItem>
        <SectionHeader title={t('upcomingLessons')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {upcomingLessons.map((lesson, i) => (
            <LessonCard key={i} {...lesson} />
          ))}
        </div>
      </StaggerItem>

      {/* Recent lessons */}
      <StaggerItem>
        <SectionHeader
          title={t('completedLessons')}
          action={
            <Button variant="ghost" size="sm" className="normal-case tracking-normal">
              {common('viewAll')}
            </Button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recentLessons.map((lesson, i) => (
            <LessonCard key={i} {...lesson} />
          ))}
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}

function formatLessonDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
