import { Card, SectionHeader, StatusChip } from '@/components/ui';
import type { ProgressDetail } from '@/lib/server/services/student-progress';
import { cn } from '@/lib/utils';

export type ProgressDetailLabels = {
  attendanceTitle: string;
  attendanceEmpty: string;
  attendanceStatuses: {
    present: string;
    late: string;
    absent: string;
    excused: string;
    unconfirmed: string;
  };
  attendanceRate: (percent: number) => string;
  lessonsTitle: string;
  lessonsEmpty: string;
  lessonStatuses: {
    scheduled: string;
    cancelled: string;
    postponed: string;
    completed: string;
  };
  privateLessonLabel: string;
  gradesTitle: string;
  gradesEmpty: string;
  gradeAverage: (percent: number) => string;
  evaluationsTitle: string;
  evaluationsEmpty: string;
};

const ATTENDANCE_TONES: Record<string, 'emerald' | 'amber' | 'red' | 'gray'> = {
  absent: 'red',
  excused: 'amber',
  late: 'amber',
  present: 'emerald',
  unconfirmed: 'gray',
};

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
  }).format(new Date(iso));
}

// The four progress parameters, shared verbatim between the student's own
// screen and the teacher's student detail: attendance, lesson history,
// assignment grades and teacher evaluation notes. No financial data here.
export function ProgressDetailSections({
  detail,
  labels,
  locale,
}: {
  detail: ProgressDetail;
  labels: ProgressDetailLabels;
  locale: string;
}) {
  const counted = detail.lessons.filter(
    (lesson) =>
      lesson.attendanceStatus === 'present' ||
      lesson.attendanceStatus === 'late' ||
      lesson.attendanceStatus === 'absent',
  );
  const attended = counted.filter(
    (lesson) => lesson.attendanceStatus !== 'absent',
  ).length;
  const attendancePercent = counted.length
    ? Math.round((attended / counted.length) * 100)
    : 0;
  const attendanceCounts = (
    ['present', 'late', 'absent', 'excused'] as const
  ).map((status) => ({
    count: detail.lessons.filter(
      (lesson) => lesson.attendanceStatus === status,
    ).length,
    status,
  }));

  const gradeAverage = detail.grades.length
    ? Math.round(
        (detail.grades.reduce(
          (sum, grade) => sum + grade.score / (grade.maxScore || 100),
          0,
        ) /
          detail.grades.length) *
          100,
      )
    : 0;

  return (
    <>
      <Card padded>
        <SectionHeader title={labels.attendanceTitle} />
        {counted.length || attendanceCounts.some((c) => c.count > 0) ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-2xl bg-[#533089]/7 px-4 py-2 text-sm font-bold text-[#533089]">
              {labels.attendanceRate(attendancePercent)}
            </span>
            {attendanceCounts.map((entry) => (
              <span
                key={entry.status}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#F8F9FC] px-3 py-2 text-xs font-bold text-[#2E286C]/65"
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    entry.status === 'present' && 'bg-emerald-500',
                    entry.status === 'late' && 'bg-amber-400',
                    entry.status === 'absent' && 'bg-red-500',
                    entry.status === 'excused' && 'bg-gray-400',
                  )}
                />
                {labels.attendanceStatuses[entry.status]}: {entry.count}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">
            {labels.attendanceEmpty}
          </p>
        )}
      </Card>

      <Card padded>
        <SectionHeader title={labels.lessonsTitle} />
        {detail.lessons.length ? (
          <div className="space-y-2">
            {detail.lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F8F9FC] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[#2E286C]">
                    {lesson.title || labels.privateLessonLabel}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-[#2E286C]/45">
                    {formatDate(lesson.startsAt, locale)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lesson.status !== 'completed' && (
                    <StatusChip
                      tone={
                        lesson.status === 'cancelled'
                          ? 'red'
                          : lesson.status === 'postponed'
                            ? 'amber'
                            : 'gray'
                      }
                    >
                      {labels.lessonStatuses[lesson.status]}
                    </StatusChip>
                  )}
                  {lesson.attendanceStatus &&
                    lesson.status !== 'cancelled' && (
                      <StatusChip
                        tone={
                          ATTENDANCE_TONES[lesson.attendanceStatus] ?? 'gray'
                        }
                      >
                        {labels.attendanceStatuses[lesson.attendanceStatus]}
                      </StatusChip>
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">
            {labels.lessonsEmpty}
          </p>
        )}
      </Card>

      <Card padded>
        <SectionHeader title={labels.gradesTitle} />
        {detail.grades.length ? (
          <>
            <p className="mb-4 inline-flex rounded-2xl bg-[#533089]/7 px-4 py-2 text-sm font-bold text-[#533089]">
              {labels.gradeAverage(gradeAverage)}
            </p>
            <div className="space-y-2">
              {detail.grades.map((grade, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F8F9FC] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[#2E286C]">
                      {grade.assignmentTitle}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-[#2E286C]/45">
                      {formatDate(grade.gradedAt, locale)}
                    </div>
                  </div>
                  <span className="text-sm font-black tabular-nums text-[#533089]">
                    {grade.score}/{grade.maxScore}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">
            {labels.gradesEmpty}
          </p>
        )}
      </Card>

      <Card padded>
        <SectionHeader title={labels.evaluationsTitle} />
        {detail.evaluations.length ? (
          <div className="space-y-3">
            {detail.evaluations.map((evaluation, index) => (
              <div
                key={index}
                className="rounded-2xl border-l-4 border-[#533089]/40 bg-[#F8F9FC] px-4 py-3"
              >
                <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-[#2E286C]/80">
                  {evaluation.note}
                </p>
                <p className="mt-2 text-xs font-bold text-[#2E286C]/45">
                  {evaluation.teacherName} —{' '}
                  {formatDate(evaluation.updatedAt, locale)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-[#2E286C]/45">
            {labels.evaluationsEmpty}
          </p>
        )}
      </Card>
    </>
  );
}
