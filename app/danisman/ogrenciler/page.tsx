import { GraduationCap } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function AdvisorStudentsPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={GraduationCap}
        title="Öğrencilerim"
        description="Danışmana bağlı öğrencilerin profil, teklif, görüşme ve takip akışı burada olacak."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
