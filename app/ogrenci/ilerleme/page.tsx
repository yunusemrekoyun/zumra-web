'use client';

import { Card, SectionHeader, ProgressRing, StreakBadge, StatusChip, CountUp, StaggerContainer, StaggerItem } from '@/components/ui';
import { Award, BookOpen, Headphones, Mic, PenLine } from 'lucide-react';

/* ─── Data ────────────────────────────────────────────────────────── */

const skills = [
  { name: 'Speaking', icon: 'speaking', value: 72, tone: 'brand' as const },
  { name: 'Listening', icon: 'listening', value: 65, tone: 'blue' as const },
  { name: 'Reading', icon: 'reading', value: 80, tone: 'emerald' as const },
  { name: 'Writing', icon: 'writing', value: 55, tone: 'amber' as const },
];

const badges = [
  { label: '12 Gün Seri', earned: true },
  { label: '10 Ders Tamamla', earned: true },
  { label: '50 Kelime Öğren', earned: true },
  { label: 'İlk Sunum', earned: false },
  { label: 'B2 Seviyesi', earned: false },
];

/* ─── Component ───────────────────────────────────────────────────── */

export default function IlerlemePage() {
  return (
    <StaggerContainer className="admin-page">
      <StaggerItem>
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">İlerleme</h1>
        <p className="text-sm font-medium text-[#2E286C]/50 mb-6">Genel durumun ve beceri analizin</p>
      </StaggerItem>

      {/* Main progress */}
      <StaggerItem>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <Card padded className="flex flex-col items-center justify-center text-center lg:col-span-1">
            <div className="relative mb-4">
              <ProgressRing value={65} size={140} strokeWidth={12} tone="brand" />
            </div>
            <h3 className="font-bold text-[#2E286C] text-lg">Genel İlerleme</h3>
            <p className="text-sm text-[#2E286C]/50 font-medium mt-1">
              <CountUp to={12} /> / <CountUp to={24} /> ders tamamlandı
            </p>
            <div className="mt-4">
              <StreakBadge count={12} size="sm" />
            </div>
          </Card>

          {/* Skill breakdown */}
          <Card padded className="lg:col-span-2">
            <SectionHeader title="Beceri Analizi" />
            <div className="space-y-5">
              {skills.map((skill) => (
                <div key={skill.name} className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#533089]/5 flex items-center justify-center shrink-0">
                    <SkillIcon name={skill.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-[#2E286C]">{skill.name}</span>
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
          <SectionHeader title="Başarılar & Rozetler" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {badges.map((badge, i) => (
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
                <span className="text-[11px] font-bold text-center text-[#2E286C]/70">{badge.label}</span>
                {badge.earned && (
                  <StatusChip tone="emerald">Kazanıldı</StatusChip>
                )}
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
