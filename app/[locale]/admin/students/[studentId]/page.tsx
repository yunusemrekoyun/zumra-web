import React from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, FileText, Mail, MessageSquare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ActionBar, Button, Card, InfoField, ModulePanel, StatusChip } from '@/components/ui';
import { getCurrentWorkspaceUser, getDomainLanguageKey, getStudentDetailData } from '@/lib/domain';
import { requireWorkspaceRole } from '@/lib/server/authorization';

type StudentDetailPageProps = {
  params: Promise<{ locale: string; studentId: string }>;
};

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  const { locale, studentId } = await params;
  await requireWorkspaceRole('admin', locale);
  const detail = getStudentDetailData('admin', getCurrentWorkspaceUser('admin'), studentId);

  if (!detail) {
    notFound();
  }

  return <StudentDetailContent detail={detail} />;
}

function StudentDetailContent({ detail }: { detail: NonNullable<ReturnType<typeof getStudentDetailData>> }) {
  const locale = useLocale();
  const t = useTranslations('admin.studentDetail');
  const studentsT = useTranslations('admin.students');
  const common = useTranslations('common.actions');
  const dateFallback = useTranslations('common.dateFallback');
  const status = useTranslations('common.status');
  const domain = useTranslations('domain');
  const { lessons, student, teachers, timeline } = detail;
  const completedLessons = lessons.filter((lesson) => lesson.status === 'completed');
  const timelineEvents = timeline
    .map((event) => ({
      event,
      lesson: lessons.find((lesson) => lesson.id === event.lessonId),
    }))
    .sort((a, b) => getLessonTime(b.lesson?.startsAt) - getLessonTime(a.lesson?.startsAt))
    .slice(0, 2);
  const languageKey = getDomainLanguageKey(student.language);
  const studentLanguage = languageKey ? domain(`languages.${languageKey}`) : student.language;
  const programLabel = domain(`programTypes.${student.programType}`);
  const teacherNames = teachers.length
    ? teachers.map((teacher) => teacher.name).join(', ')
    : studentsT('toAssign');
  const statusTone = student.status === 'active' ? 'emerald' : 'amber';

  return (
    <div className="admin-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.03]">
        <div className="flex items-center gap-4">
          <Link href="/admin/students" aria-label={t('backToStudents')} className="w-10 h-10 bg-white rounded-full border border-black/5 flex items-center justify-center hover:bg-black/5 transition-colors">
            <ChevronLeft className="w-5 h-5 text-[#2E286C]" />
          </Link>
          <div>
            <h1 className="text-2xl font-rosmatika font-medium text-[#2E286C]">{student.fullName}</h1>
            <div className="text-xs text-[#2E286C]/50 font-medium">{t('studentId')}: #{student.id}</div>
          </div>
        </div>
        <ActionBar>
          <Button variant="secondary" size="sm">
            <Mail className="w-4 h-4" /> {t('email')}
          </Button>
          <Button size="sm" className="hover:scale-105">
            <MessageSquare className="w-4 h-4" /> {t('sendMessage')}
          </Button>
        </ActionBar>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          <ModulePanel className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-[#533089]/10 text-[#533089] border-4 border-white shadow-md flex items-center justify-center font-bold text-3xl mx-auto mb-4">
              {getInitials(student.fullName)}
            </div>
            <h2 className="text-xl font-bold text-[#2E286C] text-center">{student.fullName}</h2>
            <StatusChip tone={statusTone} className="mx-auto mt-2">
              {status(student.status)}
            </StatusChip>

            <div className="w-full h-px bg-black/[0.03] my-6" />

            <div className="text-left w-full space-y-4">
              <InfoField label={t('registeredProgram')} value={`${studentLanguage} • ${programLabel}`} />
              <InfoField label={t('currentLevel')} value={student.level} />
              <InfoField label={t('instructor')} value={teacherNames} valueClassName="text-[#533089]" />
              <InfoField label={t('enrollmentDate')} value={t('enrollmentDateValue')} valueClassName="text-[#2E286C]/70" />
            </div>
          </ModulePanel>
        </div>

        <div className="flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            <Card variant="gradient" className="relative overflow-hidden group">
              <div className="relative z-10">
                <div className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{t('completedLessons')}</div>
                <div className="text-3xl font-rosmatika font-medium mb-1">
                  {completedLessons.length} <span className="text-lg opacity-50">/ {Math.max(lessons.length, completedLessons.length)}</span>
                </div>
                <div className="text-sm text-emerald-300 font-bold">{t('attendance')}</div>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10 scale-150 translate-x-4 translate-y-4 group-hover:scale-110 transition-transform duration-700">
                <CheckCircle2 className="w-24 h-24" />
              </div>
            </Card>

            <ModulePanel>
              <div className="text-[#2E286C]/50 text-xs font-bold uppercase tracking-widest mb-1">{t('developmentScore')}</div>
              <div className="text-3xl font-rosmatika font-medium text-[#2E286C] mb-1">{student.progress}</div>
              <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-bold">
                {t('scoreTrend')}
              </div>
            </ModulePanel>

            <ModulePanel>
              <div className="text-[#2E286C]/50 text-xs font-bold uppercase tracking-widest mb-1">{t('homework')}</div>
              <div className="text-3xl font-rosmatika font-medium text-[#2E286C] mb-1">{Math.max(completedLessons.length, 1)} <span className="text-lg text-[#2E286C]/30">/ {Math.max(lessons.length, 1)}</span></div>
              <div className="flex items-center gap-1.5 text-sm text-amber-500 font-bold">
                <AlertCircle className="w-4 h-4" /> {t('lateHomework')}
              </div>
            </ModulePanel>
          </div>

          <ModulePanel className="lg:rounded-[2.5rem] p-5 lg:p-8 flex-1">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-8">
              <h3 className="text-xl font-bold text-[#2E286C]">{t('courseHistory')}</h3>
              <Button variant="ghost" size="sm">{common('viewAll')}</Button>
            </div>

            <div className="relative">
              <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-[#533089]/10" />

              <div className="space-y-8 relative z-10">
                {timelineEvents.map(({ event, lesson }, index) => (
                  <div key={event.id} className="flex gap-4 lg:gap-6">
                    <div className={index === 0
                      ? 'w-6 h-6 rounded-full bg-[#533089] text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-white'
                      : 'w-6 h-6 rounded-full bg-[#533089]/20 flex items-center justify-center shrink-0 ring-4 ring-white'}
                    >
                      {index === 0 ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-2 h-2 rounded-full bg-[#533089]" />}
                    </div>
                    <ModulePanel variant={index === 0 ? 'muted' : 'default'} className="rounded-2xl p-5 flex-1">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                        <div className="font-bold text-[#2E286C]">
                          {lesson ? `${lesson.title} - ${lesson.topic}` : t('courseHistory')}
                        </div>
                        <div className="text-xs font-medium text-[#2E286C]/50">
                          {lesson ? formatLessonDate(lesson.startsAt, locale) : dateFallback('planned')}
                        </div>
                      </div>
                      <p className="text-sm text-[#2E286C]/70 leading-relaxed mb-4">
                        {t(`timelineNotes.${event.noteKey}`)}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        {event.attachmentName && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-black/5 text-xs font-bold text-[#2E286C]/60 hover:border-[#533089]/30 cursor-pointer transition-colors">
                            <FileText className="w-3 h-3" /> {event.attachmentName}
                          </div>
                        )}
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                          {event.homeworkState === 'assigned' ? t('homeworkAssigned') : (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> {t('homeworkCompleted')}
                            </>
                          )}
                        </div>
                      </div>
                    </ModulePanel>
                  </div>
                ))}
              </div>
            </div>
          </ModulePanel>
        </div>
      </div>
    </div>
  );
}

function formatLessonDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  }).format(new Date(value));
}

function getLessonTime(value?: string) {
  return value ? new Date(value).getTime() : 0;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
