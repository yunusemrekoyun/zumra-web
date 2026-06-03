import { Settings } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function AdvisorSettingsPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={Settings}
        title="Danışman Ayarları"
        description="Bildirim tercihleri, çalışma saatleri ve profil ayarları burada yönetilecek."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
