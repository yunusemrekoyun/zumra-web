import { MessageSquare } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function AdvisorMessagesPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={MessageSquare}
        title="Mesajlar"
        description="Öğrenci ve lead iletişim geçmişi burada tek akışta toplanacak."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
