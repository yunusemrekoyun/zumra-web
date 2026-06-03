import { Calendar } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function AdvisorMeetingsPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={Calendar}
        title="Görüşmeler"
        description="Link, QR, hatırlatma ve görüşme durumları bu modülde yönetilecek."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
