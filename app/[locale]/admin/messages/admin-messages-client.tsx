'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ClipboardList,
  Eye,
  FileText,
  History,
  MessageSquare,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Avatar, EmptyState, StatusChip } from '@/components/ui';
import { cn } from '@/lib/utils';

type ListItem = {
  conversationId: string;
  studentName: string;
  instructorName: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  messageCount: number;
};

type Attachment = {
  mediaAssetId: string;
  name: string;
  kind: 'image' | 'video' | 'document' | 'audio';
};

type TranscriptMessage = {
  id: string;
  senderRole: 'student' | 'instructor';
  senderName: string;
  body?: string;
  attachments: Attachment[];
  assignment?: { id: string; title: string; requiresSubmission: boolean };
  createdAt: string;
};

type Transcript = {
  conversationId: string;
  studentName: string;
  instructorName: string;
  messageCount: number;
  hasOlder: boolean;
  messages: TranscriptMessage[];
};

export function AdminMessagesClient() {
  const t = useTranslations('admin.messages');
  const locale = useLocale();
  const [items, setItems] = useState<ListItem[]>([]);
  const [listTruncated, setListTruncated] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Out-of-order response guards: only the latest request may commit state.
  const listRequestSeq = useRef(0);
  const threadRequestSeq = useRef(0);
  // Scroll intent for the next transcript render: jump to bottom on a fresh
  // open, keep the viewport anchored when older messages are prepended.
  const scrollPlanRef = useRef<
    { kind: 'bottom' } | { kind: 'preserve'; previousHeight: number } | null
  >(null);

  const loadList = useCallback(async (q: string) => {
    const seq = ++listRequestSeq.current;
    setListError(false);
    try {
      const url = q
        ? `/api/admin/conversations?q=${encodeURIComponent(q)}`
        : '/api/admin/conversations';
      const response = await fetch(url, { credentials: 'same-origin' });
      const body = await response.json().catch(() => ({}));
      if (seq !== listRequestSeq.current) return;
      if (!response.ok || !body.conversations) throw new Error('list_failed');
      setItems(body.conversations);
      setListTruncated(Boolean(body.truncated));
    } catch {
      if (seq !== listRequestSeq.current) return;
      setListError(true);
    } finally {
      if (seq === listRequestSeq.current) setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => void loadList(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query, loadList]);

  const openConversation = useCallback(async (conversationId: string) => {
    const seq = ++threadRequestSeq.current;
    setSelectedId(conversationId);
    setTranscript(null);
    setThreadLoading(true);
    setThreadError(false);
    try {
      const response = await fetch(
        `/api/admin/conversations/${conversationId}`,
        { credentials: 'same-origin' },
      );
      const body = await response.json().catch(() => ({}));
      if (seq !== threadRequestSeq.current) return;
      if (!response.ok || !body.conversation) throw new Error('thread_failed');
      scrollPlanRef.current = { kind: 'bottom' };
      setTranscript(body.conversation);
    } catch {
      if (seq !== threadRequestSeq.current) return;
      setTranscript(null);
      setThreadError(true);
    } finally {
      if (seq === threadRequestSeq.current) setThreadLoading(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    if (!transcript || !transcript.hasOlder || olderLoading) return;
    const seq = threadRequestSeq.current;
    const oldest = transcript.messages[0]?.createdAt;
    if (!oldest) return;
    setOlderLoading(true);
    try {
      const response = await fetch(
        `/api/admin/conversations/${transcript.conversationId}?before=${encodeURIComponent(oldest)}`,
        { credentials: 'same-origin' },
      );
      const body = await response.json().catch(() => ({}));
      if (seq !== threadRequestSeq.current) return;
      if (!response.ok || !body.conversation) throw new Error('older_failed');
      const older: Transcript = body.conversation;
      scrollPlanRef.current = {
        kind: 'preserve',
        previousHeight: scrollContainerRef.current?.scrollHeight ?? 0,
      };
      setTranscript((current) =>
        current && current.conversationId === older.conversationId
          ? {
              ...current,
              hasOlder: older.hasOlder,
              messages: [...older.messages, ...current.messages],
            }
          : current,
      );
    } catch {
      // Older-page fetch failing is non-destructive; the loaded thread stays.
    } finally {
      if (seq === threadRequestSeq.current) setOlderLoading(false);
    }
  }, [transcript, olderLoading]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const plan = scrollPlanRef.current;
    if (!container || !plan) return;
    scrollPlanRef.current = null;
    if (plan.kind === 'bottom') {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTop = container.scrollHeight - plan.previousHeight;
    }
  }, [transcript]);

  const listPane = (
    <div className="flex flex-col rounded-3xl border border-black/[0.04] bg-white">
      <div className="flex items-center gap-2 border-b border-black/[0.05] p-2.5">
        <Search className="ml-1 h-4 w-4 shrink-0 text-[#2E286C]/35" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          maxLength={100}
          className="flex-1 bg-transparent text-sm font-medium text-[#2E286C] outline-none placeholder:text-[#2E286C]/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-lg p-2.5 text-[#2E286C]/40 hover:bg-black/[0.03]"
            aria-label="clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setListLoading(true);
            void loadList(query.trim());
          }}
          className="rounded-lg p-2.5 text-[#2E286C]/40 transition-colors hover:bg-black/[0.03] hover:text-[#533089]"
          aria-label={t('refresh')}
          title={t('refresh')}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {listTruncated && (
        <p className="border-b border-black/[0.05] px-4 py-2 text-[11px] font-semibold text-[#2E286C]/45">
          {t('listTruncated')}
        </p>
      )}
      <div className="max-h-[65vh] min-h-[20rem] space-y-1 overflow-y-auto p-2">
        {listLoading ? (
          <p className="p-4 text-sm font-medium text-[#2E286C]/40">
            {t('loading')}
          </p>
        ) : listError ? (
          <p className="p-4 text-sm font-semibold text-[#B42318]">
            {t('error')}
          </p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm font-medium text-[#2E286C]/40">
            {query ? t('searchNoResults') : t('emptyDescription')}
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.conversationId}
              type="button"
              onClick={() => void openConversation(item.conversationId)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors',
                selectedId === item.conversationId
                  ? 'bg-[#533089]/8'
                  : 'hover:bg-black/[0.02]',
              )}
            >
              <Avatar name={item.studentName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-bold text-[#2E286C]">
                    {item.studentName}
                    <span className="px-1 font-medium text-[#2E286C]/35">↔</span>
                    {item.instructorName}
                  </h3>
                  {item.lastMessageAt && (
                    <span className="shrink-0 text-[10px] font-semibold text-[#2E286C]/35">
                      {formatDate(item.lastMessageAt, locale)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-medium text-[#2E286C]/45">
                  {item.lastMessagePreview ??
                    (item.messageCount > 0
                      ? t('attachmentOnly')
                      : t('noMessages'))}
                </p>
              </div>
              {item.messageCount > 0 && (
                <StatusChip tone="gray">{item.messageCount}</StatusChip>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  const threadPane = (
    <div className="flex flex-col rounded-3xl border border-black/[0.04] bg-white">
      {!selectedId ? (
        <EmptyState
          icon={MessageSquare}
          title={t('selectTitle')}
          description={t('selectDescription')}
          className="min-h-[24rem]"
        />
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-black/[0.05] p-3">
            <button
              type="button"
              onClick={() => {
                threadRequestSeq.current += 1;
                setSelectedId(null);
                setTranscript(null);
                setThreadError(false);
                setThreadLoading(false);
              }}
              className="rounded-lg p-2.5 text-[#2E286C]/40 hover:bg-black/[0.03] lg:hidden"
              aria-label={t('back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-[#2E286C]">
                {transcript
                  ? `${transcript.studentName} ↔ ${transcript.instructorName}`
                  : '…'}
              </h2>
              {transcript && (
                <p className="text-[11px] font-semibold text-[#2E286C]/40">
                  {t('messageCount', { count: transcript.messageCount })}
                </p>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#533089]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#533089]">
              <Eye className="h-3.5 w-3.5" />
              {t('readOnly')}
            </span>
            <button
              type="button"
              onClick={() => selectedId && void openConversation(selectedId)}
              disabled={threadLoading}
              className="rounded-lg p-2.5 text-[#2E286C]/40 transition-colors hover:bg-black/[0.03] hover:text-[#533089] disabled:opacity-40"
              aria-label={t('refresh')}
              title={t('refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={scrollContainerRef}
            className="flex max-h-[60vh] min-h-[24rem] flex-col gap-3 overflow-y-auto p-4"
          >
            {threadLoading ? (
              <p className="m-auto text-sm font-medium text-[#2E286C]/40">
                {t('loading')}
              </p>
            ) : threadError ? (
              <p className="m-auto text-sm font-semibold text-[#B42318]">
                {t('error')}
              </p>
            ) : !transcript || transcript.messages.length === 0 ? (
              <p className="m-auto text-sm font-medium text-[#2E286C]/40">
                {t('emptyThread')}
              </p>
            ) : (
              <>
                {transcript.hasOlder && (
                  <button
                    type="button"
                    onClick={() => void loadOlder()}
                    disabled={olderLoading}
                    className="mx-auto inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#533089] transition-colors hover:bg-[#533089]/5 disabled:opacity-50"
                  >
                    <History className="h-3.5 w-3.5" />
                    {olderLoading ? t('loading') : t('loadOlder')}
                  </button>
                )}
                {transcript.messages.map((message) => (
                  <TranscriptBubble
                    key={message.id}
                    message={message}
                    locale={locale}
                    labels={{
                      student: t('studentRole'),
                      teacher: t('teacherRole'),
                      assignment: t('assignment'),
                      material: t('material'),
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <div className={cn(selectedId && 'hidden lg:block')}>{listPane}</div>
      <div className={cn(!selectedId && 'hidden lg:block')}>{threadPane}</div>
    </div>
  );
}

function TranscriptBubble({
  message,
  locale,
  labels,
}: {
  message: TranscriptMessage;
  locale: string;
  labels: {
    student: string;
    teacher: string;
    assignment: string;
    material: string;
  };
}) {
  const fromInstructor = message.senderRole === 'instructor';
  return (
    <div className={cn('flex', fromInstructor ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          fromInstructor
            ? 'bg-[#533089] text-white'
            : 'bg-[#F8F9FC] text-[#2E286C]',
        )}
      >
        <p
          className={cn(
            'text-[10px] font-bold uppercase tracking-wider',
            fromInstructor ? 'text-white/60' : 'text-[#533089]/70',
          )}
        >
          {message.senderName} · {fromInstructor ? labels.teacher : labels.student}
        </p>
        {message.body && (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium leading-6">
            {message.body}
          </p>
        )}
        {message.assignment && (
          <div
            className={cn(
              'mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold',
              fromInstructor ? 'bg-white/15 text-white' : 'bg-white text-[#533089]',
            )}
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span className="truncate">{message.assignment.title}</span>
            <span className="ml-auto shrink-0 opacity-70">
              {message.assignment.requiresSubmission
                ? labels.assignment
                : labels.material}
            </span>
          </div>
        )}
        {message.attachments.map((attachment) => (
          <TranscriptAttachment
            key={attachment.mediaAssetId}
            attachment={attachment}
            fromInstructor={fromInstructor}
          />
        ))}
        <p
          className={cn(
            'mt-1 text-[10px] font-semibold',
            fromInstructor ? 'text-white/60' : 'text-[#2E286C]/35',
          )}
        >
          {formatDate(message.createdAt, locale)}
        </p>
      </div>
    </div>
  );
}

function TranscriptAttachment({
  attachment,
  fromInstructor,
}: {
  attachment: Attachment;
  fromInstructor: boolean;
}) {
  const url = `/api/media/${attachment.mediaAssetId}`;
  if (attachment.kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.name}
          className="max-h-48 rounded-xl object-cover"
        />
      </a>
    );
  }
  if (attachment.kind === 'audio') {
    return (
      <audio controls src={url} className="mt-2 w-56 max-w-full">
        <track kind="captions" />
      </audio>
    );
  }
  if (attachment.kind === 'video') {
    return (
      <video controls src={url} className="mt-2 max-h-48 rounded-xl">
        <track kind="captions" />
      </video>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold',
        fromInstructor ? 'bg-white/15 text-white' : 'bg-white text-[#533089]',
      )}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{attachment.name}</span>
    </a>
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
