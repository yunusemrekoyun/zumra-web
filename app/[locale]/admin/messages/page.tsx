import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { ChatModeTabs } from '@/components/staff-chat/chat-mode-tabs';
import { StaffChatSection } from '@/components/staff-chat/staff-chat-section';
import { requireWorkspaceRole } from '@/lib/server/authorization';
import { AdminMessagesClient } from './admin-messages-client';

type AdminMessagesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminMessagesPage({
  params,
  searchParams,
}: AdminMessagesPageProps) {
  const { locale } = await params;
  const { tab } = await searchParams;
  const principal = await requireWorkspaceRole('admin', locale);
  const [t, staffT] = await Promise.all([
    getTranslations('admin.messages'),
    getTranslations('staffChat'),
  ]);
  const staffTab = tab === 'staff';

  return (
    <div className="admin-page">
      <PageHeader
        title={staffTab ? staffT('title') : t('title')}
        description={staffTab ? staffT('description') : t('description')}
      />
      <ChatModeTabs
        active={staffTab ? 'staff' : 'primary'}
        basePath="/admin/messages"
        primaryLabel={staffT('tabOversight')}
        staffLabel={staffT('tabStaff')}
      />
      {staffTab ? (
        <StaffChatSection locale={locale} principal={principal} />
      ) : (
        <AdminMessagesClient />
      )}
    </div>
  );
}
