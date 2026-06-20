import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getLessonAttendanceDraft } from '@/lib/server/services/lesson-meetings';
import { AttendanceFormClient } from './attendance-form-client';

type TeacherAttendancePageProps = {
  params: Promise<{ lessonSessionId: string; locale: string }>;
};

export default async function TeacherAttendancePage({
  params,
}: TeacherAttendancePageProps) {
  const { lessonSessionId, locale } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('teacher.attendance');

  let draft: Awaited<ReturnType<typeof getLessonAttendanceDraft>>;
  try {
    draft = await getLessonAttendanceDraft(principal, lessonSessionId);
  } catch {
    notFound();
  }

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <AttendanceFormClient
        initial={draft}
        lessonSessionId={lessonSessionId}
        locale={locale}
      />
    </div>
  );
}
