'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileText,
  ImageIcon,
  Music,
  Pause,
  Play,
  Paperclip,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AttachmentItem = {
  mediaAssetId: string;
  name: string;
  sizeBytes?: number | null;
};

type AttachmentKind = 'audio' | 'image' | 'pdf' | 'file';

const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'weba']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic']);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function inferKind(name: string): AttachmentKind {
  const ext = extensionOf(name);
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'file';
}

function mediaUrl(id: string, inline = false) {
  return inline ? `/api/media/${id}?view=1` : `/api/media/${id}`;
}

function formatSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Modern inline audio player — replaces the default browser <audio controls>.
// ---------------------------------------------------------------------------
export function AudioPlayer({ attachment }: { attachment: AttachmentItem }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const size = formatSize(attachment.sizeBytes);

  // Metadata can finish loading (esp. from cache) before React attaches the
  // onLoadedMetadata handler, so sync the known duration on mount too.
  useEffect(() => {
    const el = audioRef.current;
    if (el && el.readyState >= 1 && Number.isFinite(el.duration)) {
      setDuration(el.duration);
    }
  }, []);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    el.currentTime = ratio * duration;
    setCurrent(el.currentTime);
  }

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-gradient-to-br from-[#F4F2FA] to-white p-2.5 pr-3 ring-1 ring-black/[0.05] shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Duraklat' : 'Oynat'}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#533089] text-white shadow-md shadow-[#533089]/25 transition-colors hover:bg-[#43236f]"
      >
        {playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 translate-x-0.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Music className="h-3 w-3 shrink-0 text-[#533089]/50" />
          <span className="truncate text-xs font-bold text-[#2E286C]">
            {attachment.name}
          </span>
        </div>
        <div
          role="slider"
          aria-label="İlerleme"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          tabIndex={0}
          onClick={seek}
          className="group mt-2 h-2 cursor-pointer rounded-full bg-[#533089]/12"
        >
          <div
            className="relative h-full rounded-full bg-[#533089] transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          >
            <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-[#533089] opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-semibold tabular-nums text-[#2E286C]/45">
          <span>{formatTime(current)}</span>
          <span>{duration ? formatTime(duration) : size ?? ''}</span>
        </div>
      </div>

      <a
        href={mediaUrl(attachment.mediaAssetId)}
        download
        aria-label="İndir"
        className="shrink-0 rounded-lg p-2 text-[#2E286C]/35 transition-colors hover:bg-black/[0.04] hover:text-[#533089]"
      >
        <Download className="h-4 w-4" />
      </a>

      <audio
        ref={audioRef}
        src={mediaUrl(attachment.mediaAssetId)}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-app preview modal for images and PDFs.
// ---------------------------------------------------------------------------
function PreviewModal({
  attachment,
  kind,
  onClose,
}: {
  attachment: AttachmentItem;
  kind: 'image' | 'pdf';
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {kind === 'image' ? (
              <ImageIcon className="h-4 w-4 shrink-0 text-[#533089]" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-[#533089]" />
            )}
            <span className="truncate text-sm font-bold text-[#2E286C]">
              {attachment.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={mediaUrl(attachment.mediaAssetId)}
              download
              aria-label="İndir"
              className="rounded-lg p-2 text-[#2E286C]/40 transition-colors hover:bg-black/[0.04] hover:text-[#533089]"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="rounded-lg p-2 text-[#2E286C]/40 transition-colors hover:bg-black/[0.04] hover:text-[#2E286C]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[#F4F5F8]">
          {kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element -- auth-gated media
            <img
              src={mediaUrl(attachment.mediaAssetId)}
              alt={attachment.name}
              className="mx-auto max-h-[80dvh] w-auto object-contain"
            />
          ) : (
            <iframe
              src={mediaUrl(attachment.mediaAssetId, true)}
              title={attachment.name}
              className="h-[80dvh] w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared attachment renderer: inline audio player, image thumbnail + lightbox,
// PDF/file cards that open an in-app preview modal.
// ---------------------------------------------------------------------------
export function AttachmentList({
  attachments,
  label,
  className,
}: {
  attachments: AttachmentItem[];
  label?: string;
  className?: string;
}) {
  const [preview, setPreview] = useState<{
    attachment: AttachmentItem;
    kind: 'image' | 'pdf';
  } | null>(null);

  if (!attachments.length) return null;

  return (
    <div className={cn('mt-3', className)}>
      {label && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#2E286C]/40">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {attachments.map((attachment) => {
          const kind = inferKind(attachment.name);

          if (kind === 'audio') {
            return <AudioPlayer key={attachment.mediaAssetId} attachment={attachment} />;
          }

          if (kind === 'image') {
            return (
              <button
                key={attachment.mediaAssetId}
                type="button"
                onClick={() => setPreview({ attachment, kind: 'image' })}
                className="group relative w-fit overflow-hidden rounded-2xl ring-1 ring-black/[0.06] transition-shadow hover:shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated media */}
                <img
                  src={mediaUrl(attachment.mediaAssetId)}
                  alt={attachment.name}
                  className="max-h-40 w-auto max-w-[16rem] object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 truncate bg-gradient-to-t from-black/55 to-transparent px-2.5 py-1.5 text-[10px] font-semibold text-white">
                  <ImageIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                </span>
              </button>
            );
          }

          const isPdf = kind === 'pdf';
          const size = formatSize(attachment.sizeBytes);
          return (
            <button
              key={attachment.mediaAssetId}
              type="button"
              onClick={() =>
                isPdf
                  ? setPreview({ attachment, kind: 'pdf' })
                  : window.open(mediaUrl(attachment.mediaAssetId), '_blank')
              }
              className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-white p-2.5 text-left ring-1 ring-black/[0.06] transition-colors hover:bg-[#533089]/[0.03]"
            >
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                  isPdf
                    ? 'bg-[#B42318]/10 text-[#B42318]'
                    : 'bg-[#533089]/10 text-[#533089]',
                )}
              >
                {isPdf ? (
                  <FileText className="h-5 w-5" />
                ) : (
                  <Paperclip className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[#2E286C]">
                  {attachment.name}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#2E286C]/40">
                  {isPdf ? 'PDF' : extensionOf(attachment.name) || 'Dosya'}
                  {size ? ` · ${size}` : ''}
                </span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-[#2E286C]/30" />
            </button>
          );
        })}
      </div>

      {preview && (
        <PreviewModal
          attachment={preview.attachment}
          kind={preview.kind}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
