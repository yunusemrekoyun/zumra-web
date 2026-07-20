import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { z } from 'zod';
import {
  Card,
  InfoField,
  PageHeader,
  ProgressRing,
  SectionHeader,
  StatusChip,
} from '@/components/ui';
import { Link } from '@/i18n/navigation';
import {
  ProgressDetailSections,
  type ProgressDetailLabels,
} from '@/components/progress-detail-sections';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  AuthorizationDeniedError,
  PublicFlowError,
} from '@/lib/server/http/errors';
import { getTeacherStudentProgress } from '@/lib/server/services/student-progress';
import { EvaluationForm } from './evaluation-form';

type TeacherStudentDetailPageProps = {
  params: Promise<{ locale: string; studentId: string }>;
};

export default async function TeacherStudentDetailPage({
  params,
}: TeacherStudentDetailPageProps) {
  const { locale, studentId } = await params;
  const principal = await requireWorkspaceRole('teacher', locale);

  if (!z.string().uuid().safeParse(studentId).success) {
    notFound();
  }

  let data;
  try {
    data = await getTeacherStudentProgress(principal, studentId);
  } catch (error) {
    if (
      error instanceof AuthorizationDeniedError ||
      error instanceof PublicFlowError
    ) {
      notFound();
    }
    throw error;
  }

  const [t, detailT, calendarT] = await Promise.all([
    getTranslations('teacher.studentDetail'),
    getTranslations('progressDetail'),
    getTranslations('teacher.students'),
  ]);

  const detailLabels: ProgressDetailLabels = {
    attendanceTitle: detailT('attendanceTitle'),
    attendanceEmpty: detailT('attendanceEmpty'),
    attendanceStatuses: {
      present: detailT('attendanceStatuses.present'),
      late: detailT('attendanceStatuses.late'),
      absent: detailT('attendanceStatuses.absent'),
      excused: detailT('attendanceStatuses.excused'),
      unconfirmed: detailT('attendanceStatuses.unconfirmed'),
    },
    attendanceRate: (percent) => detailT('attendanceRate', { percent }),
    lessonsTitle: detailT('lessonsTitle'),
    lessonsEmpty: detailT('lessonsEmpty'),
    lessonStatuses: {
      scheduled: detailT('lessonStatuses.scheduled'),
      cancelled: detailT('lessonStatuses.cancelled'),
      postponed: detailT('lessonStatuses.postponed'),
      completed: detailT('lessonStatuses.completed'),
    },
    privateLessonLabel: detailT('privateLessonLabel'),
    gradesTitle: detailT('gradesTitle'),
    gradesEmpty: detailT('gradesEmpty'),
    gradeAverage: (percent) => detailT('gradeAverage', { percent }),
    evaluationsTitle: detailT('evaluationsTitle'),
    evaluationsEmpty: detailT('evaluationsEmpty'),
  };

  return (
    <div className="workspace-page space-y-4">
      <PageHeader
        title={data.student.fullName}
        description={t('description')}
        action={
          <Link
            className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F9FC] px-4 py-2.5 text-xs font-bold text-[#533089] transition-colors hover:bg-[#533089]/7"
            href="/ogretmen/ogrenciler"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
        }
      />

      <Card padded>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <ProgressRing
              value={data.developmentScore}
              size={96}
              strokeWidth={9}
              tone="brand"
            />
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-[#533089]" />
                <span className="text-sm font-bold text-[#2E286C]">
                  {t('developmentScore')}
                </span>
              </div>
              <StatusChip
                className="mt-2"
                tone={data.student.status === 'active' ? 'emerald' : 'amber'}
              >
                {calendarT(`enrollmentStatuses.${data.student.status}` as never)}
              </StatusChip>
            </div>
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoField
              label={t('fields.program')}
              value={data.student.programName ?? '—'}
            />
            <InfoField
              label={t('fields.branch')}
              value={data.student.branchName ?? calendarT('privateLesson')}
            />
            <InfoField
              label={t('fields.level')}
              value={data.student.currentLevel ?? '—'}
            />
            <InfoField
              label={t('fields.enrolledAt')}
              value={formatDate(data.student.enrolledAt, locale)}
            />
          </div>
        </div>
      </Card>

      <ProgressDetailSections
        detail={data.detail}
        labels={detailLabels}
        locale={locale}
      />

      <Card padded>
        <SectionHeader
          title={t('evaluationTitle')}
          description={t('evaluationDescription')}
        />
        <EvaluationForm
          initialNote={data.myEvaluation}
          studentProfileId={data.student.id}
          labels={{
            placeholder: t('evaluationPlaceholder'),
            save: t('evaluationSave'),
            saving: t('evaluationSaving'),
            success: t('evaluationSuccess'),
            error: t('evaluationError'),
            hint: t('evaluationHint'),
          }}
        />
      </Card>
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
