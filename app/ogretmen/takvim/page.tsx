import { Calendar } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function TeacherCalendarPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={Calendar}
        title="Takvim"
        description="Öğretmenin ders programı, müsaitlikleri ve görüşmeleri burada yönetilecek."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
