'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, Send } from 'lucide-react';
import { ModulePanel, StatusChip } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  StaffContact,
  StaffConversationListItem,
  StaffMessageView,
} from '@/lib/server/services/staff-chat';

export type StaffChatLabels = {
  conversationsTitle: string;
  conversationsEmpty: string;
  newMessage: string;
  start: string;
  roles: { admin: string; advisor: string; teacher: string };
  threadEmpty: string;
  placeholder: string;
  send: string;
  error: string;
  selectHint: string;
};

const ROLE_TONES = {
  admin: 'purple',
  advisor: 'blue',
  teacher: 'emerald',
} as const;

function formatTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));
}

export function StaffChatClient({
  initialContacts,
  initialConversations,
  labels,
  locale,
}: {
  initialContacts: StaffContact[];
  initialConversations: StaffConversationListItem[];
  labels: StaffChatLabels;
  locale: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [contacts, setContacts] = useState(initialContacts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StaffMessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [peerChoice, setPeerChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const refreshList = useCallback(async () => {
    try {
      const response = await fetch('/api/staff-chat/conversations', {
        credentials: 'same-origin',
      });
      if (!response.ok) return;
      const body = await response.json();
      if (body.conversations) setConversations(body.conversations);
      if (body.contacts) setContacts(body.contacts);
    } catch {
      // ignore — retried on the next poll
    }
  }, []);

  const openConversation = useCallback(async (conversationId: string) => {
    setActiveId(conversationId);
    setMessages([]);
    setErrorText('');
    try {
      const response = await fetch(
        `/api/staff-chat/conversations/${conversationId}/messages`,
        { credentials: 'same-origin' },
      );
      if (!response.ok) throw new Error('failed');
      const body = await response.json();
      if (activeIdRef.current !== conversationId) return;
      setMessages(body.messages ?? []);
      void fetch(`/api/staff-chat/conversations/${conversationId}/read`, {
        body: '{}',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversationId ? { ...item, unreadCount: 0 } : item,
        ),
      );
    } catch {
      setErrorText('load');
    }
  }, []);

  // Poll the open thread for new messages; refresh the list less often.
  useEffect(() => {
    const thread = setInterval(async () => {
      const conversationId = activeIdRef.current;
      if (!conversationId) return;
      try {
        const last = messages[messages.length - 1];
        const query = last ? `?after=${last.id}` : '';
        const response = await fetch(
          `/api/staff-chat/conversations/${conversationId}/messages${query}`,
          { credentials: 'same-origin' },
        );
        if (!response.ok) return;
        const body = await response.json();
        const fresh: StaffMessageView[] = body.messages ?? [];
        if (fresh.length && activeIdRef.current === conversationId) {
          setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            return [
              ...current,
              ...fresh.filter((message) => !known.has(message.id)),
            ];
          });
          void fetch(`/api/staff-chat/conversations/${conversationId}/read`, {
            body: '{}',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          });
        }
      } catch {
        // ignore
      }
    }, 5000);
    const list = setInterval(() => void refreshList(), 20000);
    return () => {
      clearInterval(thread);
      clearInterval(list);
    };
  }, [messages, refreshList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function startConversation() {
    if (!peerChoice || busy) return;
    setBusy(true);
    setErrorText('');
    try {
      const response = await fetch('/api/staff-chat/conversations', {
        body: JSON.stringify({ peerUserId: peerChoice }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('failed');
      const body = await response.json();
      await refreshList();
      if (body.conversation?.id) {
        await openConversation(body.conversation.id);
      }
      setPeerChoice('');
    } catch {
      setErrorText('start');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const conversationId = activeId;
    const body = draft.trim();
    if (!conversationId || !body || busy) return;
    setBusy(true);
    setErrorText('');
    try {
      const response = await fetch(
        `/api/staff-chat/conversations/${conversationId}/messages`,
        {
          body: JSON.stringify({ body }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('failed');
      const payload = await response.json();
      if (payload.message) {
        setMessages((current) => [...current, payload.message]);
      }
      setDraft('');
      void refreshList();
    } catch {
      setErrorText('send');
    } finally {
      setBusy(false);
    }
  }

  const activeConversation = conversations.find((item) => item.id === activeId);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
      {/* Left: conversations + new message */}
      <ModulePanel className="rounded-3xl">
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
            {labels.newMessage}
          </div>
          <div className="flex gap-2">
            <select
              className="h-10 min-w-0 flex-1 rounded-2xl border border-[#2E286C]/10 bg-[#F8F9FC] px-3 text-sm font-semibold text-[#2E286C] outline-none focus:border-[#533089]/30"
              disabled={busy}
              onChange={(event) => setPeerChoice(event.target.value)}
              value={peerChoice}
            >
              <option value="">—</option>
              {contacts.map((contact) => (
                <option key={contact.userId} value={contact.userId}>
                  {contact.fullName} · {labels.roles[contact.role]}
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-[#533089] px-3 text-xs font-bold text-white transition-colors hover:bg-[#43236f] disabled:opacity-50"
              disabled={busy || !peerChoice}
              onClick={() => void startConversation()}
              type="button"
            >
              <MessageSquarePlus className="h-4 w-4" />
              {labels.start}
            </button>
          </div>
        </div>

        <div className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#2E286C]/40">
          {labels.conversationsTitle}
        </div>
        {conversations.length ? (
          <div className="mt-3 space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void openConversation(conversation.id)}
                className={cn(
                  'w-full rounded-2xl px-4 py-3 text-left transition-colors',
                  conversation.id === activeId
                    ? 'bg-[#533089]/10'
                    : 'bg-[#F8F9FC] hover:bg-[#533089]/5',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-[#2E286C]">
                    {conversation.peer.fullName}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusChip tone={ROLE_TONES[conversation.peer.role]}>
                      {labels.roles[conversation.peer.role]}
                    </StatusChip>
                    {conversation.unreadCount > 0 && (
                      <span className="rounded-full bg-[#533089] px-2 py-0.5 text-[10px] font-black text-white">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </span>
                </div>
                {conversation.lastMessagePreview && (
                  <p className="mt-1 truncate text-xs font-medium text-[#2E286C]/45">
                    {conversation.lastMessagePreview}
                  </p>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-[#2E286C]/45">
            {labels.conversationsEmpty}
          </p>
        )}
      </ModulePanel>

      {/* Right: thread */}
      <ModulePanel className="flex min-h-[28rem] flex-col rounded-3xl">
        {activeConversation ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-black/[0.04] pb-3">
              <span className="text-sm font-bold text-[#2E286C]">
                {activeConversation.peer.fullName}
              </span>
              <StatusChip tone={ROLE_TONES[activeConversation.peer.role]}>
                {labels.roles[activeConversation.peer.role]}
              </StatusChip>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto py-4">
              {messages.length ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.mine ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-4 py-2.5',
                        message.mine
                          ? 'bg-[#533089] text-white'
                          : 'bg-[#F8F9FC] text-[#2E286C]',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6">
                        {message.body}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-[10px] font-semibold',
                          message.mine ? 'text-white/60' : 'text-[#2E286C]/40',
                        )}
                      >
                        {formatTime(message.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm font-medium text-[#2E286C]/45">
                  {labels.threadEmpty}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {errorText && (
              <p className="mb-2 text-xs font-semibold text-[#B42318]">
                {labels.error}
              </p>
            )}

            <div className="flex gap-2 border-t border-black/[0.04] pt-3">
              <textarea
                className="max-h-32 min-h-11 flex-1 resize-y rounded-2xl border border-[#2E286C]/10 bg-[#F8F9FC] px-4 py-2.5 text-sm font-medium text-[#2E286C] outline-none placeholder:text-[#2E286C]/35 focus:border-[#533089]/30"
                maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={labels.placeholder}
                rows={1}
                value={draft}
              />
              <button
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#533089] px-4 text-xs font-bold text-white transition-colors hover:bg-[#43236f] disabled:opacity-50"
                disabled={busy || !draft.trim()}
                onClick={() => void send()}
                type="button"
              >
                <Send className="h-4 w-4" />
                {labels.send}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm font-medium text-[#2E286C]/45">
              {labels.selectHint}
            </p>
          </div>
        )}
      </ModulePanel>
    </div>
  );
}
