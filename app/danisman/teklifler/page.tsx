import { Target } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function AdvisorOffersPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={Target}
        title="Teklifler"
        description="Öğrenciye mail ve WhatsApp üzerinden gönderilecek teklif akışı burada hazırlanacak."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
