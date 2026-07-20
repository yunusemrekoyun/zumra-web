import { getTranslations } from 'next-intl/server';
import { MessagesWorkspace } from '@/components/messages-workspace';
import { StaffChatSection } from '@/components/staff-chat/staff-chat-section';
import { ChatModeTabs } from '@/components/staff-chat/chat-mode-tabs';
import { requireWorkspaceRole } from '@/lib/server/authorization';

type TeacherMessagesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; with?: string }>;
};

export default async function TeacherMessagesPage({
  params,
  searchParams,
}: TeacherMessagesPageProps) {
  const { locale } = await params;
  const { tab, with: withId } = await searchParams;
  const principal = await requireWorkspaceRole('teacher', locale);
  const t = await getTranslations('staffChat');
  const staffTab = tab === 'staff';

  return (
    <div className="workspace-page">
      <ChatModeTabs
        active={staffTab ? 'staff' : 'primary'}
        basePath="/ogretmen/mesajlar"
        primaryLabel={t('tabStudents')}
        staffLabel={t('tabStaff')}
      />
      {staffTab ? (
        <StaffChatSection locale={locale} principal={principal} />
      ) : (
        <MessagesWorkspace
          principal={principal}
          locale={locale}
          basePath={`/${locale}/ogretmen/mesajlar`}
          withId={withId}
        />
      )}
    </div>
  );
}
