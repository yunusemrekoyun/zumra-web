import { requireWorkspaceRole } from '@/lib/server/authorization';
import { listManualDiscounts } from '@/lib/server/services/pricing';
import { getProgramManagementData } from '@/lib/server/services/programs';
import { DiscountsClient } from './_components/discounts-client';

type DiscountsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DiscountsPage({ params }: DiscountsPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const [management, manualDiscounts] = await Promise.all([
    getProgramManagementData(principal),
    listManualDiscounts(principal),
  ]);

  const branches = management.branches
    .filter((branch) => !branch.archivedAt)
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      programName: branch.programName,
    }));

  return (
    <DiscountsClient
      branches={branches}
      manualDiscounts={manualDiscounts}
      packages={management.discountPackages}
    />
  );
}
