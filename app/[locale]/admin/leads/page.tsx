import { getDashboardData } from '@/lib/domain';
import { withWorkspacePage } from '@/lib/server/workspace-page';
import { LeadsClient } from './_components/leads-client';

function LeadsPage() {
  return <LeadsClient dashboard={getDashboardData('admin')} />;
}

export default withWorkspacePage('admin', LeadsPage);
