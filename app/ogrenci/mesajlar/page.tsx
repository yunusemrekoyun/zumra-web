import { MessageSquare } from 'lucide-react';
import { EmptyState, Button } from '@/components/ui';

export default function StudentMessagesPage() {
  return (
    <div className="admin-page">
      <EmptyState
        icon={MessageSquare}
        title="Mesajlar"
        description="Eğitmeninle ve akademi ile mesajlaşma modülü yakında burada olacak."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
