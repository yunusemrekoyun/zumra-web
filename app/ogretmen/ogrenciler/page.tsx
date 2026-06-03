import { GraduationCap } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function TeacherStudentsPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={GraduationCap}
        title="Öğrenciler"
        description="Öğretmene atanmış öğrenciler ve ders ilerleme notları burada görünecek."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
