import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ModulePanel, PageHeader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listAssignmentsForLesson } from '@/lib/server/services/assignments';
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

  const linkedAssignments = await listAssignmentsForLesson(
    principal,
    lessonSessionId,
  ).catch(() => []);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <AttendanceFormClient
        initial={draft}
        lessonSessionId={lessonSessionId}
        locale={locale}
      />

      {linkedAssignments.length > 0 && (
        <ModulePanel className="mt-4 rounded-3xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#2E286C]/60">
            {t('linkedAssignments')}
          </h2>
          <ul className="mt-3 space-y-2">
            {linkedAssignments.map((assignment) => (
              <li key={assignment.id}>
                <Link
                  href={`/ogretmen/odevler/${assignment.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.05] bg-white px-4 py-3 transition-colors hover:border-[#533089]/20"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[#2E286C]">
                      {assignment.title}
                    </span>
                    {assignment.dueAt ? (
                      <span className="text-xs font-medium text-[#2E286C]/45">
                        {new Intl.DateTimeFormat(locale, {
                          day: 'numeric',
                          month: 'long',
                          timeZone: APP_TIME_ZONE,
                        }).format(new Date(assignment.dueAt))}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-[#2E286C]/30" />
                </Link>
              </li>
            ))}
          </ul>
        </ModulePanel>
      )}
    </div>
  );
}
