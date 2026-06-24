import { requireWorkspaceRole } from '@/lib/server/authorization';
import { getStorageOverview } from '@/lib/server/services/storage-admin';
import { StorageClient } from './_components/storage-client';

type StoragePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StoragePage({ params }: StoragePageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('admin', locale);
  const overview = await getStorageOverview(principal);
  return <StorageClient overview={overview} />;
}
