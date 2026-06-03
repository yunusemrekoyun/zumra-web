import { BookOpen } from 'lucide-react';
import { WorkspaceEmptyDashboard } from '@/components/ui';
import { getVisibleLessons, getVisibleStudents, workspaceUsers } from '@/lib/domain';

export default function TeacherDashboardPage() {
  const teacher = workspaceUsers.find((user) => user.role === 'teacher');
  const lessons = teacher ? getVisibleLessons(teacher) : [];
  const students = teacher ? getVisibleStudents(teacher) : [];
  const upcomingLessons = lessons.filter((lesson) => lesson.status === 'upcoming');
  const completedLessons = lessons.filter((lesson) => lesson.status === 'completed');

  return (
    <WorkspaceEmptyDashboard
      icon={BookOpen}
      title="Öğretmen Paneli"
      description="Dersler, öğrenciler, takvim ve mesajlaşma için öğretmen workspace kabuğu hazır."
      moduleTitle="Öğretmen Modülleri"
      metrics={[
        { label: 'Öğrenciler', value: students.length },
        { label: 'Yaklaşan Ders', value: upcomingLessons.length },
        { label: 'Tamamlanan Ders', value: completedLessons.length },
        { label: 'Aktif Program', value: '1' },
      ]}
    />
  );
}
