'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { uploadMedia } from '@/lib/media-upload-client';
import { useRouter } from '@/i18n/navigation';

/**
 * Click-to-change profile photo. `endpoint` decides whose photo: the
 * self-service route or the admin moderation route for another user.
 */
export function ProfilePhotoUploader({
  editable = true,
  endpoint = '/api/profile/photo',
  name,
  photoUrl,
  size = 'xl',
}: {
  editable?: boolean;
  endpoint?: string;
  name: string;
  photoUrl: string | null;
  size?: 'lg' | 'xl';
}) {
  const t = useTranslations('workspace.profilePhoto');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(false);
    try {
      const mediaAssetId = await uploadMedia(file, 'image');
      const response = await fetch(endpoint, {
        body: JSON.stringify({ mediaAssetId }),
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('photo_attach_failed');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removePhoto() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(endpoint, {
        credentials: 'same-origin',
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('photo_remove_failed');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!editable) {
    return <Avatar name={name} size={size} src={photoUrl} />;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={t('change')}
          className="group relative block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#533089]"
        >
          <Avatar name={name} size={size} src={photoUrl} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[#2E286C]/45 opacity-0 transition-opacity group-hover:opacity-100">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </span>
        </button>
        {photoUrl && !busy && (
          <button
            type="button"
            onClick={removePhoto}
            aria-label={t('remove')}
            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#2E286C]/60 shadow ring-1 ring-black/10 transition-colors hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <span className="text-[11px] font-semibold text-[#2E286C]/40">
        {t('hint')}
      </span>
      {error && (
        <span className="text-xs font-semibold text-red-600">{t('error')}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
