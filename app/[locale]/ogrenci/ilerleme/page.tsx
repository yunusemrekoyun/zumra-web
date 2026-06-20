import { getTranslations } from 'next-intl/server';
import { Award, BookOpen, Headphones, Mic, PenLine } from 'lucide-react';
import {
  Card,
  EmptyState,
  ProgressRing,
  SectionHeader,
  StaggerContainer,
  StaggerItem,
  StatusChip,
} from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getStudentWorkspaceData } from '@/lib/server/services/student-workspace';

/* ─── Component ───────────────────────────────────────────────────── */

const SKILLS = [
  { icon: 'speaking', key: 'speaking' },
  { icon: 'listening', key: 'listening' },
  { icon: 'reading', key: 'reading' },
  { icon: 'writing', key: 'writing' },
] as const;

type IlerlemePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function IlerlemePage({ params }: IlerlemePageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const data = await getStudentWorkspaceData(principal);
  const [t, common, calendar] = await Promise.all([
    getTranslations('student.progressPage'),
    getTranslations('common.actions'),
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

  const total = data.lessons.totalCount;
  const completed = data.lessons.completedCount;
  const overall = total > 0 ? Math.round((completed / total) * 100) : 0;
  const badgeLabels = t.raw('badgeLabels') as string[];

  return (
    <StaggerContainer className="admin-page">
      <StaggerItem>
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">
          {t('title')}
        </h1>
        <p className="text-sm font-medium text-[#2E286C]/50 mb-6">
          {t('description')}
        </p>
      </StaggerItem>

      {/* Main progress */}
      <StaggerItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <Card
            padded
            className="flex flex-col items-center justify-center text-center lg:col-span-1"
          >
            <div className="relative mb-4">
              <ProgressRing
                value={overall}
                size={140}
                strokeWidth={12}
                tone="brand"
              />
            </div>
            <h3 className="font-bold text-[#2E286C] text-lg">{t('overall')}</h3>
            <p className="text-sm text-[#2E286C]/50 font-medium mt-1">
              {t('completedCount', { done: completed, total })}
            </p>
            {data.student.currentLevel && (
              <div className="mt-4">
                <StatusChip tone="purple">{data.student.currentLevel}</StatusChip>
              </div>
            )}
          </Card>

          {/* Skill breakdown — placeholder, real data not available yet */}
          <Card padded className="lg:col-span-2">
            <SectionHeader
              title={t('skillAnalysis')}
              action={<StatusChip>{common('soon')}</StatusChip>}
            />
            <div className="space-y-5">
              {SKILLS.map((skill) => (
                <div key={skill.key} className="flex items-center gap-4 opacity-50">
                  <div className="w-9 h-9 rounded-xl bg-[#533089]/5 flex items-center justify-center shrink-0">
                    <SkillIcon name={skill.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-[#2E286C]">
                      {t(`skills.${skill.key}`)}
                    </span>
                    <div className="mt-1.5 h-2 bg-[#F8F9FC] rounded-full overflow-hidden border border-black/[0.02]" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </StaggerItem>

      {/* Badges — placeholder, real data not available yet */}
      <StaggerItem>
        <Card padded>
          <SectionHeader
            title={t('badges')}
            action={<StatusChip>{common('soon')}</StatusChip>}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {badgeLabels.map((label, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border bg-[#F8F9FC] border-black/[0.02] opacity-50"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-200 text-gray-400">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-center text-[#2E286C]/70">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}

function SkillIcon({ name }: { name: string }) {
  const className = 'w-4 h-4 text-[#533089]';

  switch (name) {
    case 'listening':
      return <Headphones className={className} />;
    case 'reading':
      return <BookOpen className={className} />;
    case 'writing':
      return <PenLine className={className} />;
    default:
      return <Mic className={className} />;
  }
}
