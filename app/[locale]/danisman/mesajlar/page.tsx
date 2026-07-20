import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui';
import { StaffChatSection } from '@/components/staff-chat/staff-chat-section';
import { requireWorkspaceRole } from '@/lib/server/authorization';

type AdvisorMessagesPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdvisorMessagesPage({
  params,
}: AdvisorMessagesPageProps) {
  const { locale } = await params;
  const principal = await requireWorkspaceRole('advisor', locale);
  const t = await getTranslations('staffChat');

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      <StaffChatSection locale={locale} principal={principal} />
    </div>
  );
}
