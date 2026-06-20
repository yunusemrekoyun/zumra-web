import { getTranslations } from 'next-intl/server';
import { BookOpen } from 'lucide-react';
import {
  EmptyState,
  LessonCard,
  SectionHeader,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getStudentWorkspaceData } from '@/lib/server/services/student-workspace';
import { lessonCardProps } from '../lesson-display';

type DerslerPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DerslerPage({ params }: DerslerPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const data = await getStudentWorkspaceData(principal);
  const [t, calendar] = await Promise.all([
    getTranslations('student.lessons'),
    getTranslations('student.calendar'),
  ]);

  if (!data.student) {
    return (
      <EmptyState
        description={calendar('missingProfileDescription')}
        icon={BookOpen}
        title={calendar('missingProfileTitle')}
      />
    );
  }

  const { completedCount, past, totalCount, upcoming } = data.lessons;

  return (
    <StaggerContainer className="admin-page">
      <StaggerItem>
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">
          {t('title')}
        </h1>
        <p className="text-sm font-medium text-[#2E286C]/50 mb-6">
          {t('summary', { completed: completedCount, total: totalCount })}
        </p>
      </StaggerItem>

      {totalCount === 0 ? (
        <StaggerItem>
          <EmptyState
            description={calendar('emptyDescription')}
            icon={BookOpen}
            title={calendar('emptyTitle')}
          />
        </StaggerItem>
      ) : (
        <>
          {upcoming.length > 0 && (
            <StaggerItem>
              <SectionHeader title={t('upcoming')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcoming.map((event) => (
                  <LessonCard
                    key={event.id}
                    {...lessonCardProps(event, locale, 'upcoming')}
                  />
                ))}
              </div>
            </StaggerItem>
          )}

          {past.length > 0 && (
            <StaggerItem>
              <SectionHeader title={t('past')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {past.map((event) => (
                  <LessonCard
                    key={event.id}
                    {...lessonCardProps(event, locale, 'completed')}
                  />
                ))}
              </div>
            </StaggerItem>
          )}
        </>
      )}
    </StaggerContainer>
  );
}
