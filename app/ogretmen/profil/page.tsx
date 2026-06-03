import { UserCheck } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function TeacherProfilePage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={UserCheck}
        title="Profil"
        description="Öğretmen uzmanlıkları, ders ayarları ve profil bilgileri burada düzenlenecek."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
