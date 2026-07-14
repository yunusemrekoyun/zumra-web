'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import type { Attachment } from '@/components/attachment-input';
import { cn } from '@/lib/utils';

function pickMimeType(): string | null {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return null;
  }
  for (const candidate of [
    'audio/ogg;codecs=opus',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg',
  ]) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

async function uploadVoice(blob: Blob, mimeType: string): Promise<Attachment> {
  const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
  const name = `ses-${Date.now()}.${ext}`;
  const response = await fetch('/api/media', {
    body: blob,
    credentials: 'same-origin',
    headers: {
      'x-file-name': name,
      'x-media-kind': 'audio',
      'x-media-visibility': 'private',
    },
    method: 'POST',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id) throw new Error('upload_failed');
  return { mediaAssetId: body.id, name };
}

export function VoiceRecorderButton({
  onRecorded,
  disabled,
  labels,
}: {
  onRecorded: (attachment: Attachment) => void;
  disabled?: boolean;
  labels: { record: string; stop: string; uploading: string; error: string };
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'uploading'>('idle');
  const [supported, setSupported] = useState(false);
  const [failed, setFailed] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);

  // Resolve recording support only on the client, after mount — so SSR and the
  // first client render are identical (no hydration mismatch).
  useEffect(() => {
    setSupported(pickMimeType() !== null);
  }, []);

  // Release the recorder and mic tracks on unmount — otherwise the microphone
  // stays open after e.g. a client-side navigation mid-recording.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function start() {
    const mimeType = pickMimeType();
    if (!mimeType) return;
    setFailed(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (!mountedRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (!blob.size) {
          setState('idle');
          return;
        }
        setState('uploading');
        try {
          const attachment = await uploadVoice(blob, mimeType);
          if (mountedRef.current) onRecorded(attachment);
        } catch {
          if (mountedRef.current) setFailed(true);
        }
        if (mountedRef.current) setState('idle');
      };
      recorder.start();
      recorderRef.current = recorder;
      setState('recording');
    } catch {
      setState('idle');
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  // Hidden until we've confirmed (client-side) the browser can record.
  if (!supported) return null;

  const recording = state === 'recording';
  const uploading = state === 'uploading';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => (recording ? stop() : start())}
        aria-label={recording ? labels.stop : uploading ? labels.uploading : labels.record}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors disabled:opacity-40',
          recording
            ? 'border-red-500/30 bg-red-50 text-red-600'
            : 'border-black/[0.06] bg-white text-[#533089] hover:bg-black/[0.02]',
        )}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {failed && (
        <p className="absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-lg border border-red-500/20 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">
          {labels.error}
        </p>
      )}
    </div>
  );
}
