import { MessageSquare } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function TeacherMessagesPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={MessageSquare}
        title="Mesajlar"
        description="Öğrenci mesajları, ders notları ve bildirim akışları burada olacak."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
