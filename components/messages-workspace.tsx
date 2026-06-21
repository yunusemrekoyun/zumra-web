import 'server-only';

import { ArrowLeft, MessageSquare } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Avatar, EmptyState, PageHeader, StatusChip } from '@/components/ui';
import { ChatThreadClient } from '@/components/chat-thread-client';
import type { WorkspacePrincipal } from '@/lib/domain';
import {
  getConversationMessages,
  listConversations,
  markConversationRead,
  resolveConversation,
} from '@/lib/server/services/conversations';

export async function MessagesWorkspace({
  principal,
  locale,
  basePath,
  withId,
}: {
  principal: WorkspacePrincipal;
  locale: string;
  basePath: string;
  withId?: string;
}) {
  const t = await getTranslations('chat');

  if (withId) {
    let conversationId: string;
    let view: Awaited<ReturnType<typeof getConversationMessages>>;
    try {
      const resolved = await resolveConversation(principal, withId);
      conversationId = resolved.conversationId;
      view = await getConversationMessages(principal, conversationId);
      await markConversationRead(principal, conversationId);
    } catch {
      notFound();
    }

    return (
      <div className="workspace-page">
        <PageHeader
          title={view.otherPartyName}
          description={t('threadDescription')}
          action={
            <a
              href={basePath}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-xs font-bold uppercase tracking-wider text-[#2E286C] transition-colors hover:bg-black/[0.03]"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back')}
            </a>
          }
        />
        <ChatThreadClient
          conversationId={conversationId}
          initialMessages={view.messages}
          locale={locale}
          assignmentBasePath={`/${locale}/${
            principal.role === 'teacher' ? 'ogretmen' : 'ogrenci'
          }/odevler`}
          labels={{
            composerPlaceholder: t('composerPlaceholder'),
            send: t('send'),
            sending: t('sending'),
            emptyThread: t('emptyThread'),
            error: t('error'),
            attachmentsAdd: t('attachmentsAdd'),
            attachmentsUploading: t('attachmentsUploading'),
            attachmentsError: t('attachmentsError'),
            assignment: t('assignment'),
            material: t('material'),
            searchPlaceholder: t('searchPlaceholder'),
            searchNoResults: t('searchNoResults'),
            voiceRecord: t('voiceRecord'),
            voiceStop: t('voiceStop'),
            voiceUploading: t('voiceUploading'),
          }}
        />
      </div>
    );
  }

  const conversations = await listConversations(principal);

  return (
    <div className="workspace-page">
      <PageHeader title={t('title')} description={t('description')} />
      {!conversations.length ? (
        <EmptyState
          icon={MessageSquare}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          className="min-h-[24rem]"
        />
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <a
              key={conversation.otherPartyProfileId}
              href={`${basePath}?with=${conversation.otherPartyProfileId}`}
              className="flex items-center gap-3 rounded-2xl border border-black/[0.04] bg-white p-3 transition-shadow hover:shadow-sm"
            >
              <Avatar name={conversation.otherPartyName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-bold text-[#2E286C]">
                    {conversation.otherPartyName}
                  </h2>
                  {conversation.lastMessageAt && (
                    <span className="shrink-0 text-[10px] font-semibold text-[#2E286C]/35">
                      {formatDate(conversation.lastMessageAt, locale)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-medium text-[#2E286C]/45">
                  {conversation.lastMessagePreview ?? t('noMessages')}
                </p>
              </div>
              {conversation.unreadCount > 0 && (
                <StatusChip tone="purple">{conversation.unreadCount}</StatusChip>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}
