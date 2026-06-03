import { Calendar } from 'lucide-react';
import { EmptyState, Button } from '@/components/ui';

export default function CalendarPage() {
  return (
    <div className="admin-page">
      <EmptyState
        icon={Calendar}
        title="Takvim"
        description="Ders programları, görüşme randevuları ve etkinlikleri bu takvimden takip edebilirsiniz."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
