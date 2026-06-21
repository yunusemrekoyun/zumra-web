import { MessagesWorkspace } from '@/components/messages-workspace';
import { requireWorkspaceRole } from '@/lib/server/authorization';

type StudentMessagesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ with?: string }>;
};

export default async function StudentMessagesPage({
  params,
  searchParams,
}: StudentMessagesPageProps) {
  const { locale } = await params;
  const { with: withId } = await searchParams;
  const principal = await requireWorkspaceRole('student', locale);
  return (
    <MessagesWorkspace
      principal={principal}
      locale={locale}
      basePath={`/${locale}/ogrenci/mesajlar`}
      withId={withId}
    />
  );
}
