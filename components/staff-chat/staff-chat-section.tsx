import { getTranslations } from 'next-intl/server';
import type { WorkspacePrincipal } from '@/lib/domain';
import {
  listStaffContacts,
  listStaffConversations,
} from '@/lib/server/services/staff-chat';
import { StaffChatClient } from './staff-chat-client';

// Server wrapper shared by the admin, advisor and teacher pages: loads the
// initial conversation state and hands the polling client its labels.
export async function StaffChatSection({
  locale,
  principal,
}: {
  locale: string;
  principal: WorkspacePrincipal;
}) {
  const [t, conversations, contacts] = await Promise.all([
    getTranslations('staffChat'),
    listStaffConversations(principal),
    listStaffContacts(principal),
  ]);

  return (
    <StaffChatClient
      initialContacts={contacts}
      initialConversations={conversations}
      locale={locale}
      labels={{
        conversationsTitle: t('conversationsTitle'),
        conversationsEmpty: t('conversationsEmpty'),
        newMessage: t('newMessage'),
        start: t('start'),
        roles: {
          admin: t('roles.admin'),
          advisor: t('roles.advisor'),
          teacher: t('roles.teacher'),
        },
        threadEmpty: t('threadEmpty'),
        placeholder: t('placeholder'),
        send: t('send'),
        error: t('error'),
        selectHint: t('selectHint'),
      }}
    />
  );
}
