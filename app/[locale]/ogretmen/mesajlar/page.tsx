import { MessagesWorkspace } from '@/components/messages-workspace';
import { requireWorkspaceRole } from '@/lib/server/authorization';

type TeacherMessagesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ with?: string }>;
};

export default async function TeacherMessagesPage({
  params,
  searchParams,
}: TeacherMessagesPageProps) {
  const { locale } = await params;
  const { with: withId } = await searchParams;
  const principal = await requireWorkspaceRole('teacher', locale);
  return (
    <MessagesWorkspace
      principal={principal}
      locale={locale}
      basePath={`/${locale}/ogretmen/mesajlar`}
      withId={withId}
    />
  );
}
