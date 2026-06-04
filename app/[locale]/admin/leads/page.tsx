import { getDashboardData } from '@/lib/domain';
import { LeadsClient } from './_components/leads-client';

export default function LeadsPage() {
  return <LeadsClient dashboard={getDashboardData('admin')} />;
}
