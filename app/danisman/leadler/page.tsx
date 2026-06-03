import { Users } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

export default function AdvisorLeadsPage() {
  return (
    <div className="workspace-page">
      <EmptyState
        icon={Users}
        title="Leadlerim"
        description="Danışmana atanmış lead havuzu burada CRM akışıyla yönetilecek."
        action={<Button variant="secondary" disabled>Yakında</Button>}
      />
    </div>
  );
}
