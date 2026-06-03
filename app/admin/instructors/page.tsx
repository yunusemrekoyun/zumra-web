import { Presentation } from 'lucide-react';
import { EmptyState, Button } from '@/components/ui';

export default function InstructorsPage() {
  return (
    <div className="admin-page">
      <EmptyState
        icon={Presentation}
        title="Eğitmenler"
        description="Eğitmen kadronuzu bu modülden yönetebilir, ders programlarını atayabilirsiniz."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
