import { Settings } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function TeacherSettingsPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={Settings}
        title="Öğretmen Ayarları"
        description="Bildirim, takvim ve hesap tercihleri burada yönetilecek."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
