import { useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import { Card, SectionHeader, ProgressRing, StreakBadge, StatusChip, CountUp, StaggerContainer, StaggerItem } from '@/components/ui';
import { Award, BookOpen, Headphones, Mic, PenLine } from 'lucide-react';
import { getStudentProgressData } from '@/lib/domain';
import { withWorkspacePage } from '@/lib/server/workspace-page';

/* ─── Component ───────────────────────────────────────────────────── */

function IlerlemePage() {
  const t = useTranslations('student.progressPage');
  const status = useTranslations('common.status');
  const progress = getStudentProgressData('student');
  const badgeLabels = t.raw('badgeLabels') as string[];

  if (!progress) {
    notFound();
  }

  return (
    <StaggerContainer className="admin-page">
      <StaggerItem>
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">{t('title')}</h1>
        <p className="text-sm font-medium text-[#2E286C]/50 mb-6">{t('description')}</p>
      </StaggerItem>

      {/* Main progress */}
      <StaggerItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <Card padded className="flex flex-col items-center justify-center text-center lg:col-span-1">
            <div className="relative mb-4">
              <ProgressRing value={progress.overall} size={140} strokeWidth={12} tone="brand" />
            </div>
            <h3 className="font-bold text-[#2E286C] text-lg">{t('overall')}</h3>
            <p className="text-sm text-[#2E286C]/50 font-medium mt-1">
              {t('completedCount', { done: progress.completedLessons, total: progress.totalLessons })}
            </p>
            <div className="mt-4">
              <StreakBadge count={progress.streak} size="sm" />
            </div>
          </Card>

          {/* Skill breakdown */}
          <Card padded className="lg:col-span-2">
            <SectionHeader title={t('skillAnalysis')} />
            <div className="space-y-5">
              {progress.skills.map((skill) => (
                <div key={skill.key} className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#533089]/5 flex items-center justify-center shrink-0">
                    <SkillIcon name={skill.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-[#2E286C]">{t(`skills.${skill.key}`)}</span>
                      <span className="text-xs font-bold text-[#2E286C]/40">
                        %<CountUp to={skill.value} />
                      </span>
                    </div>
                    <div className="h-2 bg-[#F8F9FC] rounded-full overflow-hidden border border-black/[0.02]">
                      <div
                        className="h-full bg-gradient-to-r from-[#8C6CE6] to-[#533089] rounded-full transition-all duration-700"
                        style={{ width: `${skill.value}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </StaggerItem>

      {/* Badges */}
      <StaggerItem>
        <Card padded>
          <SectionHeader title={t('badges')} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {progress.badges.map((badge, i) => (
              <div
                key={i}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                  badge.earned
                    ? 'bg-white border-[#533089]/10 shadow-sm'
                    : 'bg-[#F8F9FC] border-black/[0.02] opacity-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  badge.earned
                    ? 'bg-gradient-to-br from-[#8C6CE6] to-[#533089] text-white shadow-md shadow-[#533089]/20'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-center text-[#2E286C]/70">{badgeLabels[i]}</span>
                {badge.earned && (
                  <StatusChip tone="emerald">{status('earned')}</StatusChip>
                )}
              </div>
            ))}
          </div>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}

export default withWorkspacePage('student', IlerlemePage);

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
