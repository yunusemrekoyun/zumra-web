import { Settings } from 'lucide-react';
import { EmptyState, Button } from '@/components/ui';

export default function SettingsPage() {
  return (
    <div className="admin-page">
      <EmptyState
        icon={Settings}
        title="Ayarlar"
        description="Genel ayarlar, bildirim tercihleri ve hesap yönetimi burada olacak."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
