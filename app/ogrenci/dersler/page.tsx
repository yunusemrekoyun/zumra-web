'use client';

import { LessonCard, SectionHeader, StaggerContainer, StaggerItem } from '@/components/ui';

/* ─── Data ────────────────────────────────────────────────────────── */

const lessons = [
  { title: 'Speaking Practice', instructor: 'Sarah Lee', dateTime: 'Bugün, 14:00', status: 'upcoming' as const, topic: 'Everyday Scenarios' },
  { title: 'Grammar Focus', instructor: 'Sarah Lee', dateTime: 'Yarın, 14:00', status: 'upcoming' as const, topic: 'Perfect Tenses' },
  { title: 'Listening Comprehension', instructor: 'Sarah Lee', dateTime: '28 Mart, 14:00', status: 'completed' as const, topic: 'News Articles' },
  { title: 'Vocabulary Building', instructor: 'Sarah Lee', dateTime: '26 Mart, 14:00', status: 'completed' as const, topic: 'Academic Words' },
  { title: 'Writing Skills', instructor: 'Sarah Lee', dateTime: '24 Mart, 14:00', status: 'completed' as const, topic: 'Essay Structure' },
  { title: 'Reading Practice', instructor: 'Sarah Lee', dateTime: '22 Mart, 14:00', status: 'completed' as const, topic: 'Short Stories' },
  { title: 'Speaking Practice', instructor: 'Sarah Lee', dateTime: '20 Mart, 14:00', status: 'completed' as const, topic: 'Job Interview' },
  { title: 'Grammar Review', instructor: 'Sarah Lee', dateTime: '18 Mart, 14:00', status: 'completed' as const, topic: 'Conditionals' },
];

/* ─── Component ───────────────────────────────────────────────────── */

export default function DerslerPage() {
  const upcoming = lessons.filter(l => l.status === 'upcoming');
  const completed = lessons.filter(l => l.status === 'completed');

  return (
    <StaggerContainer className="admin-page">
      <StaggerItem>
        <h1 className="text-2xl lg:text-3xl font-rosmatika font-medium text-[#2E286C] mb-2">Derslerim</h1>
        <p className="text-sm font-medium text-[#2E286C]/50 mb-6">Toplam {lessons.length} ders • {completed.length} tamamlandı</p>
      </StaggerItem>

      {upcoming.length > 0 && (
        <StaggerItem>
          <SectionHeader title="Yaklaşan Dersler" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((lesson, i) => (
              <LessonCard key={i} {...lesson} />
            ))}
          </div>
        </StaggerItem>
      )}

      <StaggerItem>
        <SectionHeader title="Geçmiş Dersler" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {completed.map((lesson, i) => (
            <LessonCard key={i} {...lesson} />
          ))}
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}
