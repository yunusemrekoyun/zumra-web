'use client';

import { useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';

export type Attachment = { mediaAssetId: string; name: string };

function mediaKind(file: File): 'image' | 'video' | 'audio' | 'document' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

async function uploadMedia(file: File): Promise<string> {
  const response = await fetch('/api/media', {
    body: file,
    credentials: 'same-origin',
    headers: {
      'x-file-name': file.name,
      'x-media-kind': mediaKind(file),
      'x-media-visibility': 'private',
    },
    method: 'POST',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id) throw new Error('upload_failed');
  return body.id as string;
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
  const [error, setError] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setError(false);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        const id = await uploadMedia(file);
        uploaded.push({ mediaAssetId: id, name: file.name });
      }
      onChange([...value, ...uploaded]);
    } catch {
      setError(true);
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
        disabled={disabled || busy}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-bold text-[#533089] transition-colors hover:bg-black/[0.02] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        {busy ? labels.uploading : labels.add}
      </button>
      {error && (
        <p className="text-xs font-semibold text-red-600">{labels.error}</p>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((attachment) => (
            <span
              key={attachment.mediaAssetId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8F9FC] px-2.5 py-1 text-xs font-medium text-[#2E286C]/70"
            >
              {attachment.name}
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
                className="text-[#2E286C]/40 transition-colors hover:text-red-600"
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
