'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, Search, Send, X } from 'lucide-react';
import { type Attachment, AttachmentInput } from '@/components/attachment-input';
import { VoiceRecorderButton } from '@/components/voice-recorder-button';
import { cn } from '@/lib/utils';

type ChatAttachment = {
  mediaAssetId: string;
  name: string;
  kind: 'image' | 'video' | 'document' | 'audio';
};

type ChatMessage = {
  id: string;
  mine: boolean;
  body?: string;
  attachments: ChatAttachment[];
  assignment?: { id: string; title: string; requiresSubmission: boolean };
  createdAt: string;
};

const POLL_INTERVAL_MS = 4000;

export function ChatThreadClient({
  conversationId,
  initialMessages,
  locale,
  assignmentBasePath,
  labels,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  locale: string;
  assignmentBasePath: string;
  labels: {
    composerPlaceholder: string;
    send: string;
    sending: string;
    emptyThread: string;
    error: string;
    attachmentsAdd: string;
    attachmentsUploading: string;
    attachmentsError: string;
    assignment: string;
    material: string;
    searchPlaceholder: string;
    searchNoResults: string;
    voiceRecord: string;
    voiceStop: string;
    voiceUploading: string;
  };
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ChatMessage[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<string>(
    initialMessages[initialMessages.length - 1]?.createdAt ??
      new Date(0).toISOString(),
  );

  const fetchNew = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages?since=${encodeURIComponent(cursorRef.current)}`,
        { credentials: 'same-origin' },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ChatMessage[] };
      if (!data.messages?.length) return;
      setMessages((current) => {
        const seen = new Set(current.map((m) => m.id));
        const fresh = data.messages.filter((m) => !seen.has(m.id));
        return fresh.length ? [...current, ...fresh] : current;
      });
      cursorRef.current = data.messages[data.messages.length - 1].createdAt;
    } catch {
      // transient; next tick retries
    }
  }, [conversationId]);

  useEffect(() => {
    const timer = setInterval(fetchNew, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchNew]);

  // Debounced conversation-scoped search.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/search?q=${encodeURIComponent(q)}`,
          { credentials: 'same-origin' },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { messages: ChatMessage[] };
        setResults(data.messages ?? []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, conversationId]);

  useEffect(() => {
    if (results === null) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, results]);

  async function send() {
    if (!body.trim() && !attachments.length) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          body: JSON.stringify({
            body: body.trim() || undefined,
            attachmentMediaIds: attachments.map((a) => a.mediaAssetId),
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('send_failed');
      setBody('');
      setAttachments([]);
      await fetchNew();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const renderMessage = (message: ChatMessage) => (
    <div
      key={message.id}
      className={cn('flex', message.mine ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          message.mine ? 'bg-[#533089] text-white' : 'bg-[#F8F9FC] text-[#2E286C]',
        )}
      >
        {message.body && (
          <p className="whitespace-pre-wrap text-sm font-medium leading-6">
            {message.body}
          </p>
        )}
        {message.assignment && (
          <a
            href={`${assignmentBasePath}/${message.assignment.id}`}
            className={cn(
              'mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold',
              message.mine ? 'bg-white/15 text-white' : 'bg-white text-[#533089]',
            )}
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span className="truncate">{message.assignment.title}</span>
            <span className="ml-auto shrink-0 opacity-70">
              {message.assignment.requiresSubmission
                ? labels.assignment
                : labels.material}
            </span>
          </a>
        )}
        {message.attachments.map((att) => (
          <MessageAttachment key={att.mediaAssetId} attachment={att} />
        ))}
        <p
          className={cn(
            'mt-1 text-[10px] font-semibold',
            message.mine ? 'text-white/60' : 'text-[#2E286C]/35',
          )}
        >
          {formatTime(message.createdAt, locale)}
        </p>
      </div>
    </div>
  );

  const searching = results !== null;

  return (
    <div className="flex flex-col rounded-3xl border border-black/[0.04] bg-white">
      <div className="flex items-center gap-2 border-b border-black/[0.05] p-2.5">
        <Search className="ml-1 h-4 w-4 shrink-0 text-[#2E286C]/35" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={labels.searchPlaceholder}
          maxLength={200}
          className="flex-1 bg-transparent text-sm font-medium text-[#2E286C] outline-none placeholder:text-[#2E286C]/30"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="rounded-lg p-1 text-[#2E286C]/40 hover:bg-black/[0.03]"
            aria-label="clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex max-h-[60vh] min-h-[20rem] flex-col gap-3 overflow-y-auto p-4">
        {searching ? (
          results.length === 0 ? (
            <p className="m-auto text-sm font-medium text-[#2E286C]/40">
              {labels.searchNoResults}
            </p>
          ) : (
            results.map(renderMessage)
          )
        ) : messages.length === 0 ? (
          <p className="m-auto text-sm font-medium text-[#2E286C]/40">
            {labels.emptyThread}
          </p>
        ) : (
          <>
            {messages.map(renderMessage)}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {!searching && (
        <div className="space-y-2 border-t border-black/[0.05] p-3">
          {attachments.length > 0 && (
            <AttachmentInput
              value={attachments}
              onChange={setAttachments}
              disabled={busy}
              labels={{
                add: labels.attachmentsAdd,
                uploading: labels.attachmentsUploading,
                error: labels.attachmentsError,
              }}
            />
          )}
          <div className="flex items-end gap-2">
            {attachments.length === 0 && (
              <AttachmentInput
                value={attachments}
                onChange={setAttachments}
                disabled={busy}
                labels={{
                  add: labels.attachmentsAdd,
                  uploading: labels.attachmentsUploading,
                  error: labels.attachmentsError,
                }}
              />
            )}
            <VoiceRecorderButton
              disabled={busy}
              onRecorded={(attachment) =>
                setAttachments((current) => [...current, attachment])
              }
              labels={{
                record: labels.voiceRecord,
                stop: labels.voiceStop,
                uploading: labels.voiceUploading,
              }}
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={labels.composerPlaceholder}
              rows={1}
              maxLength={5000}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-black/[0.06] bg-[#F8F9FC] px-4 py-3 text-sm font-medium text-[#2E286C] outline-none placeholder:text-[#2E286C]/30 focus:ring-2 focus:ring-[#533089]/15"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || (!body.trim() && !attachments.length)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#533089] text-white transition-colors hover:bg-[#462878] disabled:opacity-40"
              aria-label={busy ? labels.sending : labels.send}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {failed && (
            <p className="text-xs font-semibold text-[#B42318]">
              {labels.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MessageAttachment({ attachment }: { attachment: ChatAttachment }) {
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
      className="mt-2 block truncate text-xs font-semibold underline"
    >
      {attachment.name}
    </a>
  );
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}
