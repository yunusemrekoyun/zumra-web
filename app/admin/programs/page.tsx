import { BookOpen } from 'lucide-react';
import { EmptyState, Button } from '@/components/ui';

export default function ProgramsPage() {
  return (
    <div className="admin-page">
      <EmptyState
        icon={BookOpen}
        title="Programlar"
        description="Eğitim programlarınızı bu modülden oluşturup yönetebilirsiniz. Yakında aktif olacak."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
