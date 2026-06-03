'use client';

import { BookOpen, ArrowRight } from 'lucide-react';
import { Card, SectionHeader, StreakBadge, LessonCard, Avatar, StaggerContainer, StaggerItem } from '@/components/ui';
import { workspaceLessons, workspaceStudents } from '@/lib/domain';

/* ─── Data ────────────────────────────────────────────────────────── */

const currentStudent = workspaceStudents[0];
const studentLessons = workspaceLessons.filter((lesson) => lesson.studentId === currentStudent.id);
const upcomingLessons = studentLessons
  .filter((lesson) => lesson.status === 'upcoming')
  .map((lesson) => ({
    title: lesson.title,
    instructor: 'Sarah Lee',
    dateTime: formatLessonDate(lesson.startsAt),
    status: 'upcoming' as const,
    topic: lesson.topic,
  }));
const recentLessons = studentLessons
  .filter((lesson) => lesson.status === 'completed')
  .map((lesson) => ({
    title: lesson.title,
    instructor: 'Sarah Lee',
    dateTime: formatLessonDate(lesson.startsAt),
    status: 'completed' as const,
    topic: lesson.topic,
  }));

/* ─── Component ───────────────────────────────────────────────────── */

export default function StudentDashboard() {
  return (
    <StaggerContainer className="admin-page">
      {/* Welcome card */}
      <StaggerItem>
        <Card variant="gradient" className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <Avatar name="Zeynep Kaya" size="lg" variant="brand" className="border-4 border-white/20" />
              <div>
                <h1 className="text-xl lg:text-2xl font-rosmatika font-medium text-white">Merhaba, {currentStudent.fullName.split(' ')[0]}!</h1>
                <p className="text-white/70 text-sm font-medium mt-0.5">{currentStudent.level} • {currentStudent.language}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StreakBadge count={12} />
              <span className="text-white/60 text-xs font-medium">Harika gidiyorsun, devam et!</span>
            </div>
          </div>
          <BookOpen className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5" />
        </Card>
      </StaggerItem>

      {/* Next lesson highlight */}
      <StaggerItem>
        <Card padded className="border-l-4 border-l-[#533089]">
          <SectionHeader
            title="Sonraki Dersin"
            action={
              <button className="flex items-center gap-2 text-sm font-bold text-[#533089] hover:bg-[#533089]/5 px-4 py-2 rounded-xl transition-colors">
                Derse Katıl <ArrowRight className="w-4 h-4" />
              </button>
            }
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-[#2E286C] text-lg">Speaking Practice - Everyday Scenarios</h3>
              <p className="text-sm text-[#2E286C]/50 font-medium mt-1">
                Sarah Lee • {upcomingLessons[0]?.dateTime ?? 'Planlanacak'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                2 saat sonra
              </div>
            </div>
          </div>
        </Card>
      </StaggerItem>

      {/* Upcoming lessons */}
      <StaggerItem>
        <SectionHeader title="Yaklaşan Dersler" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {upcomingLessons.map((lesson, i) => (
            <LessonCard key={i} {...lesson} />
          ))}
        </div>
      </StaggerItem>

      {/* Recent lessons */}
      <StaggerItem>
        <SectionHeader
          title="Tamamlanan Dersler"
          action={
            <button className="text-sm font-bold text-[#533089] hover:bg-[#533089]/5 px-4 py-2 rounded-xl transition-colors">
              Tümünü Gör
            </button>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recentLessons.map((lesson, i) => (
            <LessonCard key={i} {...lesson} />
          ))}
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}

function formatLessonDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
