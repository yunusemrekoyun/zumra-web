import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Star,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { LucideIcon } from 'lucide-react';
import {
  Card,
  EmptyState,
  KpiCard,
  PageHeader,
  ProgressRing,
  SectionHeader,
  StatusChip,
} from '@/components/ui';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import {
  getStudentProgress,
  type StudentProgress,
} from '@/lib/server/services/student-progress';
import { cn } from '@/lib/utils';

const BADGE_ICONS: Record<string, LucideIcon> = {
  first_assignment: ClipboardCheck,
  ten_lessons: CheckCircle2,
  perfect_score: Star,
  high_average: Trophy,
  streak_4: Flame,
  improving: TrendingUp,
};

type IlerlemePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function IlerlemePage({ params }: IlerlemePageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('student', locale);
  const t = await getTranslations('student.progressPage');
  const progress = await getStudentProgress(principal);

  if (!progress.hasData) {
    return (
      <div className="workspace-page">
        <PageHeader title={t('title')} description={t('description')} />
        <EmptyState
          icon={TrendingUp}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          className="min-h-[24rem]"
        />
      </div>
    );
  }

  return (
    <div className="workspace-page space-y-4">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          padded
          className="flex flex-col items-center justify-center text-center"
        >
          <ProgressRing
            value={progress.developmentScore}
            size={150}
            strokeWidth={12}
            tone="brand"
          />
          <h3 className="mt-3 font-bold text-[#2E286C]">
            {t('developmentScore')}
          </h3>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <KpiCard
            label={t('xpLabel')}
            value={progress.xp}
            icon={Zap}
            variant="gradient"
          />
          <KpiCard
            label={t('streakLabel')}
            value={t('streakValue', { count: progress.streak })}
            icon={Flame}
          />
          <Card padded className="sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#2E286C]">
                {t('levelProgress')}
              </span>
              <StatusChip tone="purple">
                {progress.level.next
                  ? t('nextLevelLabel', {
                      current: progress.level.current,
                      next: progress.level.next,
                    })
                  : t('atMaxLevel')}
              </StatusChip>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#F8F9FC]">
              <div
                className="h-full rounded-full bg-[#533089]"
                style={{ width: `${progress.level.masteryPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-[#2E286C]/50">
              %{progress.level.masteryPercent}
            </p>
            {progress.level.readyToAdvance && (
              <p className="mt-2 text-sm font-bold text-[#0B7F58]">
                {t('readyToAdvance')}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Card padded>
        <SectionHeader title={t('breakdownTitle')} />
        <div className="grid gap-5 sm:grid-cols-3">
          <FactorBar
            label={t('factorCompletion')}
            percent={progress.breakdown.completionPercent}
            detail={t('completionDetail', {
              submitted: progress.counts.submitted,
              assigned: progress.counts.assignedHomework,
            })}
          />
          <FactorBar
            label={t('factorGrade')}
            percent={progress.breakdown.gradePercent}
            detail={t('gradeDetail', { graded: progress.counts.graded })}
          />
          <FactorBar
            label={t('factorAttendance')}
            percent={progress.breakdown.attendancePercent}
            detail={t('attendanceDetail', {
              attended: progress.counts.attended,
              lessons: progress.counts.lessons,
            })}
          />
        </div>
      </Card>

      {progress.gradeTrend.length >= 2 && (
        <Card padded>
          <SectionHeader title={t('trendTitle')} />
          <TrendBars points={progress.gradeTrend} />
        </Card>
      )}

      <Card padded>
        <SectionHeader title={t('badges')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {progress.badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.key] ?? Award;
            return (
              <div
                key={badge.key}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border p-4',
                  badge.earned
                    ? 'border-[#533089]/20 bg-[#533089]/5'
                    : 'border-black/[0.02] bg-[#F8F9FC] opacity-50',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    badge.earned
                      ? 'bg-[#533089] text-white'
                      : 'bg-gray-200 text-gray-400',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-center text-[11px] font-bold text-[#2E286C]/70">
                  {t(`badgeNames.${badge.key}`)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function FactorBar({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[#2E286C]">{label}</span>
        <span className="text-sm font-bold text-[#533089]">%{percent}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-black/[0.02] bg-[#F8F9FC]">
        <div
          className="h-full rounded-full bg-[#533089]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs font-medium text-[#2E286C]/40">{detail}</p>
    </div>
  );
}

function TrendBars({
  points,
}: {
  points: StudentProgress['gradeTrend'];
}) {
  return (
    <div className="flex h-32 items-end gap-1.5">
      {points.map((point, index) => (
        <div
          key={index}
          className="flex-1 rounded-t bg-[#533089]/80"
          style={{ height: `${Math.max(4, point.percent)}%` }}
          title={`%${point.percent}`}
        />
      ))}
    </div>
  );
}
