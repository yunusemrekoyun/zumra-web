'use client';

import { useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { uploadMedia } from '@/lib/media-upload-client';
import { useApiErrorText } from '@/lib/client/api-error';

export type Attachment = { mediaAssetId: string; name: string };

// Mirrors the server allowlist (lib/server/media/validation.ts) so the file
// picker only offers types the backend actually accepts.
const ACCEPTED_FILE_TYPES =
  'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf,audio/mpeg,audio/wav,audio/ogg';

function mediaKind(file: File): 'image' | 'video' | 'audio' | 'document' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

export function AttachmentInput({
  value,
  onChange,
  disabled,
  labels,
}: {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  disabled?: boolean;
  labels: { add: string; uploading: string; error: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorText = useApiErrorText();
  // Latest value, so slow uploads merge into fresh state instead of a stale
  // closure (e.g. an attachment removed mid-upload must not reappear).
  const valueRef = useRef(value);
  valueRef.current = value;

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setError('');
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        // Shared helper waits until the asset is 'ready' (images/videos are
        // transcoded async) — attaching earlier would 409 on send.
        const id = await uploadMedia(file, mediaKind(file));
        uploaded.push({ mediaAssetId: id, name: file.name });
      }
      onChange([...valueRef.current, ...uploaded]);
    } catch (err) {
      // Map the propagated server code to a specific, friendly message.
      setError(errorText(err instanceof Error ? err.message : null));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPTED_FILE_TYPES}
        disabled={disabled || busy}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-bold text-[#533089] transition-colors hover:bg-black/[0.02] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        {busy ? labels.uploading : labels.add}
      </button>
      {error && (
        <p className="text-xs font-semibold text-red-600">{error}</p>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((attachment) => (
            <span
              key={attachment.mediaAssetId}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[#F8F9FC] px-2.5 py-1 text-xs font-medium text-[#2E286C]/70"
            >
              <span className="min-w-0 truncate">{attachment.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    value.filter(
                      (item) => item.mediaAssetId !== attachment.mediaAssetId,
                    ),
                  )
                }
                className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#2E286C]/40 transition-colors hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
